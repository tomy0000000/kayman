# CLAUDE.md

Guidance for the Kayman backend. See the repo-root `CLAUDE.md` for cross-cutting context (toolchain, one-time setup, docker, end-to-end request flow).

## Stack

- Python 3.12
- FastAPI
- SQLModel / SQLAlchemy
- Alembic
- PostgreSQL
- Managed with `uv`

## Common commands

Run from the repo root. For the complete list of available tasks and their usage, see [`.agents/rules/tasks.md`](../.agents/rules/tasks.md). Those are the only tasks that exist: don't invent task names or usages.

Run a single test: `cd backend && uv run pytest kayman/tests/path/to/test_x.py::test_name`.

## Architecture (`backend/kayman/`)

Layered FastAPI app:

- `main.py`: app factory. Mounts all routers under `/api`, then mounts the built frontend (`backend/static` → symlink to `frontend/dist`) as an SPA fallback at `/`.
- `core/`: `config.py` (pydantic-settings, reads `instance/*.env` via `mise.*.toml`) and `db.py` (engine/session).
- `routers/`: HTTP layer. `routers/__init__.py` registers every router and its OpenAPI tag. Each file exports `<name>_router` and a `tag` dict.
- `crud/`: SQL persistence (one module per aggregate: account, currency, event, event_entry, transaction).
- `logics/`: business logic that composes multiple CRUD calls (account, event, transaction).
- `schemas/`: SQLModel table models AND pydantic request/response models in the same modules. See `schemas/README.md` for the dbdiagram link, and `.agents/rules/backend/schemas.md` for the `Base`/`table`/`Create`/`Read`/`Update` class conventions. `schemas/api_models.py` holds shared API wrappers.
- `openapi.py` + `util.py`: custom `operationId` generation and a `KustomJSONResponse` using `simplejson` for Decimal-safe encoding. Decimals are first-class throughout (high-precision currency).
- `tests/` uses `factory-boy` (see `tests/factories/`) and `conftest.py` fixtures. `test:backend` injects a dummy `POSTGRES_PASSWORD` so settings instantiates without a running DB.

Migrations live in `backend/alembic/`. Always add a migration for schema changes (`uv run alembic revision --autogenerate -m "..."`, then review the generated file before committing).

## Conventions

- **All Python tooling must be prefixed with `uv run`** (e.g. `uv run pytest`, `uv run alembic ...`, `uv run mypy ...`). The `backend/scripts/*` and `mise` tasks already do this.
- mypy runs in `strict` mode (excludes `alembic` and `kayman/tests`).
- Ruff is configured in `pyproject.toml`; pre-commit runs `ruff --fix` + `ruff-format` on every commit.
