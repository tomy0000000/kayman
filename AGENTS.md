# CLAUDE.md

This file provides guidance to work on Kayman.

For app-specific guidance, see:

- [`backend/CLAUDE.md`](backend/CLAUDE.md): FastAPI server (Python, `uv`)
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md): React/Vite SPA (TypeScript, `pnpm`)

Historical design notes and context for past decisions live in [`.agents/docs/`](.agents/docs/). Check there when a current convention's rationale isn't obvious from the code.

## Stack

- Backend: Python + FastAPI + SQLModel/SQLAlchemy + Alembic, managed with `uv`
- Frontend: TypeScript + React 19 + Vite + TanStack Router/Query + Tailwind v4 + shadcn, managed with `pnpm`
- Database: PostgreSQL
- Toolchain managed with `mise`
  - Tool versions pinned in `mise.toml`
  - Environment variable loader
  - Tasks defined as `#MISE` headers in `scripts/`, `backend/scripts/`, `frontend/scripts/`

## Common commands

Run from the repo root. All custom tasks go through `mise run <task>`. Use `mise tasks` to list everything.

### One-time setup

```bash
mise install                   # install pinned node/pnpm/python/uv
mise run setup:dotenv          # generate instance/local.env with random secrets
mise run start:db-dev          # start a postgres container named kayman-db
mise run db:upgrade            # apply alembic migrations
```

### Dev servers

```bash
mise run start                 # backend + frontend in parallel
mise run start:backend         # uvicorn with --reload on :8000 (serves /api and the built SPA at /)
mise run start:frontend        # vite dev server
```

### Docker

```bash
mise run build:docker          # builds docker image (multi-stage: frontend build → python runtime)
mise run preview:docker        # run the image against the development environment
```

## End-to-end request flow

1. Frontend calls a function from `frontend/src/lib/client/` (generated from the FastAPI OpenAPI spec).
2. FastAPI routes in `backend/kayman/routers/*` validate via pydantic/SQLModel schemas in `backend/kayman/schemas/*`.
3. Routers delegate to `backend/kayman/crud/*` for single-aggregate persistence, or `backend/kayman/logics/*` for cross-aggregate operations.
4. Responses are serialized via `KustomJSONResponse` (Decimal-safe).

The backend's built artifact also serves the frontend: `backend/static` is a symlink to `frontend/dist`, and FastAPI mounts it as an SPA fallback at `/`.

## Project conventions

- Environment files live under `instance/` (gitignored).
  - `mise.local.toml` loads `instance/local.env`
  - `mise.development.toml` loads `instance/development.env`.
- The user runs `git commit` themselves. Do the work, then stop.
