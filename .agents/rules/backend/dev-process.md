---
paths:
  - "backend/kayman/**/*.py"
---

# Backend development process

Build a **new** backend feature in this order. This applies when adding a feature
or endpoint from scratch; skip it for isolated bugfixes, renames, and small edits.

The `----commit----` markers are hard checkpoints: stop, summarize what changed,
and ask the user to commit before continuing. Don't cross a checkpoint on your own.

## 1. Design the flow (no code)

- Sketch the high-level flow end to end.
- List things to consider, propose options with tradeoffs, and call out caveats.
- Identify complex steps that may need business-logic functions (`logics/`)
  beyond plain CRUD, and propose how to structure them and compose them with the
  CRUD functions.
- **Why:** the cheapest place to catch a wrong approach is before any schema or
  signature is written.

## 2. Design schema and signatures (draft only)

- Draft the schema shape and the CRUD/logic function signatures.
- Keep this in the plan/draft. **Do not write it into the codebase yet.**

## 3. Draft schema and migration

- Write the schema classes and, if the DB shape changed, generate the Alembic
  migration (`uv run alembic revision --autogenerate -m "..."`). Review it.
- This covers creating a model (or its fields) for the **first time**: a fresh
  table and a single additive migration. Altering a field that has already
  shipped (adding NOT NULL, removing, renaming, retyping) follows the staged
  migration dances in [`schemas.md`](schemas.md#changing-schema-fields)
  instead, not this process.

`----commit----`

## 4. Mock data

- If the new model needs seed rows, add them following
  [`mock-data.md`](mock-data.md): the `backend/mock_data/<entity>.json` file and
  the `load_records` + `session.add` block in `seed.py` (in FK-dependency order).
- Confirm a reseed succeeds end to end.

`----commit----`

## 5. Blank CRUD function

- Add the CRUD function signature with an empty/stub body (e.g. `raise
  NotImplementedError` or `...`). No logic yet.

## 6. Write tests (subagent)

- Use a subagent to write the tests against the blank function's signature.
- **Why:** tests written before the implementation, by a separate context,
  describe intended behavior instead of rationalizing whatever the code happens
  to do.

## 7. Write the CRUD function

- Implement the real body to satisfy the tests.

## 8. Iterate until tests pass

- Run the tests, fix, repeat until green.

`----commit----`

## 9. Business-logic functions (if needed)

- If step 1 flagged complex steps needing `logics/` functions, repeat steps 5-8
  for them: blank function, subagent tests, real implementation, iterate until
  green. Compose them from the CRUD functions built above, then commit.
- If none are needed, skip to step 10 (no separate commit here).

`----commit---- (only if this step did work)`

## 10. Wire into the router

- Connect the top-level function (CRUD or `logics/`) to its router endpoint.

`----commit----`
