# Tasks

All tasks available in this repo are listed below, all managed by `mise`. Run any task with `mise run <task>`. List them anytime with `mise tasks ls`.

**Never `cd` into a subdirectory to run a task.** Every task is preconfigured (via `#MISE dir=...`) to run correctly from anywhere under the repo, so run `mise run <task>` directly without changing directories first.

**These are the only tasks that exist.** Do not invent task names, flags, or usages beyond what is documented here. Tasks are defined either inline in [`mise.toml`](../../mise.toml) or as `#MISE`-annotated scripts under `scripts/`, `backend/scripts/`, and `frontend/scripts/`. If you need something not covered here, add a new script or `mise.toml` task rather than guessing at one.

## Setup

| Task           | Description                                                                      | Notes                                                                                 |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `setup:dotenv` | Setup environment variables for local development                                | Generates `instance/local.env` with random secrets. Skips if the file already exists. |
| `setup:db`     | Setup empty database for local development (data will NOT persist, not for prod) | Runs `start:db` then `db:upgrade`.                                                    |

## Dev servers

| Task             | Description                                                                | Notes                                                          |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `start`          | Start all dev servers                                                      | Runs `start:backend` and `start:frontend` in parallel.         |
| `start:backend`  | Start backend server with hot reload                                       | `fastapi dev` on `0.0.0.0:8000` with `--reload`.               |
| `start:frontend` | Start frontend server with hot reload                                      | `vite` dev server (`localhost:5173`).                          |
| `start:db`       | Start PostgreSQL container for local development (data will NOT persist)   | Recreates the `kayman-db` container, starts Docker if needed.  |
| `start:db-dev`   | Start PostgreSQL, upgrade schema, and seed mock data for local development | Depends on `setup:db`. Forwards extra args to the seed script. |

## Database

| Task         | Description                                  | Usage / Notes                                                          |
| ------------ | -------------------------------------------- | ---------------------------------------------------------------------- |
| `db:upgrade` | Upgrade database schema                      | Runs `alembic upgrade head`.                                           |
| `db:backup`  | Backup PostgreSQL database to a local dump   | Writes `kayman_<timestamp>.dump` in `backend/`. Reads `instance/.env`. |
| `db:restore` | Restore PostgreSQL database from a dump file | `mise run db:restore -- path/to/data.dump`. Reads `instance/.env`.     |

## Build

| Task                   | Description                           | Usage / Notes                                                        |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `build:frontend`       | Build frontend for production         | `tsc --build` then `vite build`.                                     |
| `build:router`         | Generate frontend TanStack router     | `tsr generate`.                                                      |
| `build:openapi-spec`   | Build OpenAPI specification JSON      | `mise run build:openapi-spec -- <json_path>` (output path required). |
| `build:openapi-client` | Build OpenAPI client for the frontend | Generates the spec to a temp file, then runs `openapi-ts`.           |
| `build:docker`         | Build Docker image                    | Builds `tomy0000000/kayman:latest`.                                  |

## Format

| Task              | Description                   | Notes                 |
| ----------------- | ----------------------------- | --------------------- |
| `format:backend`  | Format backend with ruff      | `ruff format kayman`. |
| `format:frontend` | Format frontend with Prettier | `prettier --write .`. |

## Lint

| Task            | Description     | Notes                                                         |
| --------------- | --------------- | ------------------------------------------------------------- |
| `lint:backend`  | Lint backend    | `mypy`, `ruff check`, and `ruff format --check`.              |
| `lint:frontend` | Lint frontend   | `tsc --build --noEmit`, `eslint .`, and `prettier --check .`. |
| `lint:docker`   | Lint Dockerfile | `hadolint Dockerfile`.                                        |

## Test

| Task           | Description  | Notes                                                            |
| -------------- | ------------ | ---------------------------------------------------------------- |
| `test:backend` | Test backend | Runs `pytest`, then prints the path to the HTML coverage report. |

## Preview

| Task               | Description                                                 | Notes                                                      |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `preview:frontend` | Preview production build locally                            | Depends on `build:frontend`, then `vite preview`.          |
| `preview:docker`   | Preview docker run by connecting to development environment | Runs the image with `instance/development.env` on `:8000`. |

## Other

| Task              | Description                                                             | Notes                                                                                                 |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `postinstall`     | Frontend post-install hook (no `#MISE description`)                     | Generates the OpenAPI client and router. On Vercel, also downloads the schema first.                  |
| `download-schema` | Download the OpenAPI schema from a running API (no `#MISE description`) | Requires the `API_HOST` env var. Fetches `https://${API_HOST}/openapi.json` into `/tmp/openapi.json`. |
