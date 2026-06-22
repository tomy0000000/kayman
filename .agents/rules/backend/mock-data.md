---
paths:
  - "backend/mock_data/**/*.json"
  - "backend/kayman/mock_data/**/*.py"
---

# Mock data conventions

Mock data seeds the local/dev database with realistic reference rows. JSON files in `backend/mock_data/` are loaded via `kayman.mock_data.load_records` and inserted by `kayman.mock_data.seed`.

## File location and naming

- JSON files live in `backend/mock_data/<entity>.json`. No subdirectories.
- The filename stem must match the `entity` string passed to `load_records(entity, schema)` (e.g. `accounts.json` ↔ `load_records("accounts", Account)`).

## Record shape

- Top-level JSON is an array of objects.
- Every record includes an explicit `id` so cross-file FKs (e.g. `parent_id`, `currency_code`) stay stable across reseeds.
- Records are sorted by `id`, and entity with self-referential FKs (e.g. `Category.parent_id`) are sorted so parents come before children.
- Object keys are sorted alphabetically. Keeps diffs reviewable.
- Field values match the SQLModel's `Create`-ish shape: include server-derived fields only when the seed needs them (e.g. `Account.balance`).

## Schema validation via load_records

- All loads go through `load_records(entity, schema)`, which `model_validate`s each item against the SQLModel. Do not parse JSON ad hoc.
- When a schema field changes (see `backend-schemas.md`), update the matching JSON file in the same change. A reseed must succeed end-to-end.

## Adding a new entity

When introducing a new mock data file:

1. Create `backend/mock_data/<entity>.json` following the conventions above.
2. Wire it into `kayman/mock_data/seed.py`:
   - Import the SQLModel.
   - Add a `load_records(...)` + `session.add(...)` + `commit` block.
   - **Order matters**: insert in FK-dependency order. Current pattern is `currencies → categories → accounts`. Place new entities after everything they reference.
3. For self-referential tables (e.g. `Category.parent_id`), sort records by `id` before insert so parents land before children.
