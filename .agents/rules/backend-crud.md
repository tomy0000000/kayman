---
paths:
  - "backend/kayman/crud/**/*.py"
---

# Backend CRUD

Pure query/persistence helpers over SQLModel. No business logic, no orchestration — that lives in `logics/`.

## Organize by entity answered about, not table read

- Place helpers in `crud/<entity>.py` by the entity the caller is asking about. Cross-table reads are fine.
- Naming follows the entity too: `read_account_balance` (in `account.py`) even though it sums `Transaction.amount`.

## Push ordering and filtering down here

- If a `logics/` caller needs sorted, filtered, or limited data, extend the CRUD helper rather than post-processing the result in Python.
- Expose `order_by` as a `Literal[...]` column whitelist plus a `descending: bool` flag. See `TransactionOrderBy` in `crud/transaction.py`.
- DB-side ordering is faster and keeps `logics/` focused on business meaning, not data shaping.

## Signatures

- `session: Session` is always the first parameter.
- For batch/mutating writes, accept `commit: bool = True`. When `True`, commit and `refresh` the rows. When `False`, `flush` instead so a `logics/` caller can compose multiple writes in one transaction.
- For reads that precede a write, accept `for_update: bool = False` and apply `.with_for_update()` to take a row lock (see `read_accounts`).
- Convert `*Base` / `*Create` inputs to the table model with `Model.model_validate(...)` before `session.add`.

## Verify-then-mutate

- Bulk updates fetch the rows with `for_update=True`, check for missing ids, then mutate. See `_verify_account_ids` in `crud/account.py`. Raise `ValueError` on missing ids rather than silently skipping.
