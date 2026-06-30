---
paths:
  - "backend/kayman/crud/**/*.py"
---

# Backend CRUD

Pure query/persistence helpers over SQLModel. No business logic, no orchestration — that lives in `logics/`.

## Organize by entity answered about, not table read

- Place helpers in `crud/<entity>.py` by the entity the caller is asking about. Cross-table reads are fine.
- Naming follows the entity too: `read_account_balance` (in `account.py`) even though it sums `Transaction.amount`.

## Order functions CRUD, then internal

- Within a module, define functions in this order: `create`, `read`, `update`, `delete`, then internal helpers (leading-underscore functions like `_verify_account_ids`).
- **Why:** a predictable order makes any `crud/<entity>.py` scannable. The public CRUD surface reads top to bottom; private helpers live at the bottom out of the way.

## Reads return collections, never a single row

- Every read helper is plural: `read_categories`, not `read_category`. There is exactly one read function per entity.
- A caller that wants a single row passes a narrowing filter and asserts `len(result) == 1` itself. Don't add a singular convenience wrapper.
- **Why:** one read path per entity means one place to maintain filtering, ordering, and locking. Singular wrappers drift from the plural version and double the surface area.

## Creates are batch, never a single row

- Every create helper is plural and accepts a `Sequence` of inputs: `create_transactions`, not `create_transaction`. Build the rows with `Model.model_validate(...)` and `session.add_all(...)`. See `create_transactions` in `crud/transaction.py`.
- A caller creating one row passes a one-element sequence and unpacks the single result itself. Don't add a singular convenience wrapper.
- **Why:** one write path per entity means one place to maintain the `commit`/`flush` decision (see Signatures), the `model_validate` conversion, and the refresh-after-commit loop. Batch inserts via `add_all` are also a single round trip. Singular wrappers drift from the plural version and double the surface area.

## Push ordering and filtering down here

- If a `logics/` caller needs sorted, filtered, or limited data, extend the CRUD helper rather than post-processing the result in Python.
- Expose `order_by` as a `Literal[...]` column whitelist plus a `descending: bool` flag. See `TransactionOrderBy` in `crud/transaction.py`.
- DB-side ordering is faster and keeps `logics/` focused on business meaning, not data shaping.

## Filtering empty fields

- When a filter targets a nullable column, always handle the "is empty" case. Example: filtering transactions that have no `event_id`.
- Use the literal string `empty` as the special token that means "match rows where this field is unset/NULL". A normal value filters by equality; `empty` filters by `IS NULL`.
- **Why:** a missing filter value and an explicit "give me the unset ones" are different intents. A reserved token makes the second expressible without overloading `None`/absent to mean both.

## Signatures

- `session: Session` is always the first parameter.
- For batch/mutating writes, accept `commit: bool = True`. When `True`, commit and `refresh` the rows. When `False`, `flush` instead so a `logics/` caller can compose multiple writes in one transaction.
- For reads that precede a write, accept `for_update: bool = False` and apply `.with_for_update()` to take a row lock (see `read_accounts`).
- Convert `*Base` / `*Create` inputs to the table model with `Model.model_validate(...)` before `session.add`.

## Verify-then-mutate

- Bulk updates fetch the rows with `for_update=True`, check for missing ids, then mutate. See `_verify_account_ids` in `crud/account.py`. Raise `ValueError` on missing ids rather than silently skipping.
