---
paths:
  - "backend/kayman/schemas/**/*.py"
  - "backend/kayman/tests/crud/*.py"
  - "backend/kayman/tests/factories/*.py"
---

# Backend schema class conventions

Follow the SQLModel + FastAPI tutorial pattern. Each aggregate module defines a `Base` data class plus `table`/`Create`/`Read` (and sometimes `Update`) variants.

Reference: https://sqlmodel.tiangolo.com/tutorial/fastapi/multiple-models/

## `<Name>Base(SQLModel)`

Data-only. Fields shared by create input and read output. Excludes:

- `id` (server-assigned)
- Server-derived fields (e.g. `payment_id`, `index`, `balance`)
- `sa_column` / `Column(...)` directives — those are table-only

Use plain Python types and `Field(default=..., default_factory=...)`. For callable defaults use `default_factory`, never `default=callable`.

> Only inherit from data models, don't inherit from table models. — SQLModel tutorial

## `<Name>(<Name>Base, table=True)`

The SQLAlchemy table. Add here:

- `id: int | None = Field(primary_key=True, default=None)`
- Relationships (`Relationship(...)`)
- Server-derived columns excluded from `Base` (e.g. `Account.balance`, `Transaction.payment_id`, `Transaction.index`)
- `__table_args__` (constraints, indexes)
- `sa_column` overrides when the column needs a custom SQL type (timezone-aware `DateTime`, `SATimezone`, SQL `Enum`, etc.). Re-declare the field here with the same name and type, with the `sa_column=` kwarg.

## `<Name>Create(<Name>Base)`

```python
class FooCreate(FooBase):
    pass
```

Always inherit from `Base`. If `Create` needs to omit fields, that's a signal those fields don't belong in `Base` — move them to the table class.

## `<Name>Read(<Name>Base)`

Adds `id: int` (required, non-optional, because reads come from the DB). Only declare fields _not already in Base_. Do not redeclare inherited fields.

## `<Name>Update(SQLModel)`

Partial update. Inherits from `SQLModel` directly, not `Base`, because every field's type changes (required → optional with `None` default).

```python
class FooUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
```

Endpoints apply with `model_dump(exclude_unset=True)` + `db_obj.sqlmodel_update(data)`.

Only add `Update` when the resource supports PATCH.

## Changing schema fields

Any field change touches three things together: the SQLModel class, an Alembic migration, and the matching `tests/factories/*.py` + `tests/crud/*.py`. Generate migrations with `uv run alembic revision --autogenerate -m "..."` and review the output before committing.

### Adding a field

**Nullable** — single stage:

1. Add to `Base` (or to the table class if server-derived).
2. Generate the migration.
3. Add a value to the matching factory. Add assertions in `tests/crud/*.py` where other `Base` fields are asserted.

**Required (NOT NULL)** — two stages, so deploys can roll forward without breaking on a half-applied migration or a half-rolled-out app:

1. **Stage 1 — add nullable + backfill**: migration adds the column as `nullable=True` and backfills existing rows via `op.execute(...)`. Schema declares the field as optional (`<type> | None = None`). Ship.
2. **Stage 2 — tighten to NOT NULL**: migration runs `op.alter_column(..., nullable=False)`. Schema drops the optional. Ship.

### Removing a field

Two stages, so a replica still running the previous deploy can read rows after the migration:

1. **Stage 1 — stop using the field**: remove from `Base`/table/`Create`/`Read`/`Update` and from every reader/writer in `crud`, `logics`, `routers`. **Keep the column in the DB.** Update factories and CRUD tests. Ship.
2. **Stage 2 — drop the column**: migration drops it. Ship.

Collapsing both into one PR is only acceptable with planned downtime.

### Renaming a field

Expand/contract — never rename in place. Five stages, each shipped independently:

1. **Add** the new column (nullable). Migration only, no app changes.
2. **Dual-write**: writers (`crud`, `logics`) populate both old and new. Schemas expose both.
3. **Backfill**: migration copies `old → new` for existing rows. If the field should be NOT NULL, tighten the new column afterward.
4. **Read from new**: switch readers (`crud`, `logics`, `routers`, factories, tests) to the new column. Keep dual-writing so a rollback to stage 3 is safe.
5. **Drop the old column**: remove it from schemas and from the writers' dual-write paths, then a migration that drops it.

### Changing a field's type

Same flow as renaming: add-new, dual-write (transforming on the way in), backfill (transforming every row), switch readers, drop old. The new column can take a temporary name (e.g. `amount_v2`) and be renamed back as a final no-data migration after the old column is gone.

A pure widening (`varchar(50) → varchar(255)`, `int → bigint`) needs no transformation and ships as a single `alter_column` — only use the multi-step dance when the conversion is lossy or the column is hot.

## Composite API models

Cross-aggregate request/response wrappers live in `schemas/api_models.py` as plain `SQLModel` subclasses composing the per-aggregate `Create`/`Read` models (e.g. `PaymentCreateDetailed`, `PaymentReadDetailed`). Don't put them in the aggregate module.

## Reference examples

- `account.py`, `category.py`: clean Base/table/Create/Read(/Update) sets, conforming to the tutorial.
- `currency.py`: single-table reference data (seeded, read-only via API), no split needed.

## Known deviations to fix

These predate the rule. New work should follow the rule above; touch these when convenient.

- `schemas/transaction.py:20`: `created_at: datetime = Field(default=datetime.now)` should use `default_factory=datetime.now`. The function reference is being passed as a static default.
- `schemas/transaction.py:15-23`: `TransactionBase` holds `payment_id` and `index`, both server-derived. This forces `TransactionCreate(SQLModel)` (line 42) to drop Base inheritance. Move `payment_id` and `index` onto the `Transaction` table class, then `TransactionCreate(TransactionBase): pass`.
- `schemas/transaction.py:51-55`: `TransactionRead` redeclares `payment_id`, `created_at`, `timezone` already present in `TransactionBase`. Drop the redeclarations.
- `schemas/payment.py:34-42`: `PaymentBase` declares `type`, `timestamp`, `timezone` with `sa_column=Column(...)`. Move those `sa_column` overrides to the `Payment` table class; keep `PaymentBase` data-only.
- `schemas/payment.py:68-96`: `PaymentEntryBase` includes server-derived `payment_id` and `index`, forcing `PaymentEntryCreate(SQLModel)` to drop Base inheritance. Move both fields to the `PaymentEntry` table class.
