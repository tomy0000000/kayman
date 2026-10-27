# CLAUDE.md

This file provides guidance to work on Kayman.

For app-specific guidance, see:

- [`backend/AGENTS.md`](backend/AGENTS.md): FastAPI server (Python, `uv`)
- [`frontend/AGENTS.md`](frontend/AGENTS.md): React/Vite SPA (TypeScript, `pnpm`)

Historical design notes and context for past decisions live in [`.agents/docs/`](.agents/docs/). Check there when a current convention's rationale isn't obvious from the code. Don't date these docs (no "proposed on" or "implemented on"). Git history already records when they changed, and a date in the text goes stale.

## Stack

- Backend: Python + FastAPI + SQLModel/SQLAlchemy + Alembic, managed with `uv`
- Frontend: TypeScript + React 19 + Vite + TanStack Router/Query + Tailwind v4 + shadcn, managed with `pnpm`
- Database: PostgreSQL
- Toolchain managed with `mise`
  - Tool versions pinned in `mise.toml`
  - Environment variable loader
  - Tasks defined as `#MISE` headers in `scripts/`, `backend/scripts/`, `frontend/scripts/`

## Common commands

Run from the repo root. All custom tasks go through `mise run <task>`. For the complete list of available tasks and their usage, see [`.agents/rules/tasks.md`](.agents/rules/tasks.md). Those are the only tasks that exist: don't invent task names or usages.

When testing in a browser (see `frontend/AGENTS.md`), the base URL is always `localhost:5173` for the frontend and `localhost:8000` for the backend.

## End-to-end request flow

1. Frontend calls a function from `frontend/src/lib/client/` (generated from the FastAPI OpenAPI spec).
2. FastAPI routes in `backend/kayman/routers/*` validate via pydantic/SQLModel schemas in `backend/kayman/schemas/*`.
3. Routers delegate to `backend/kayman/crud/*` for single-aggregate persistence, or `backend/kayman/logics/*` for cross-aggregate operations.
4. Responses are serialized via `KustomJSONResponse` (Decimal-safe).

The backend's built artifact also serves the frontend: `backend/static` is a symlink to `frontend/dist`, and FastAPI mounts it as an SPA fallback at `/`.

## Project conventions

- Environment files live under `instance/` (gitignored).
  - `mise.toml` loads `instance/local.env` by default
  - `mise.development.toml` loads `instance/development.env` when run with `MISE_ENV=development`.
- The user runs `git commit` themselves. Do the work, then stop.
- Commit subjects follow the global prefix list, plus an optional scope: `<emoji> [<type>][<scope>] <Subject>`. Scope is one of `backend`, `frontend`, `cli` (anything under `cli/`), or `agent` (anything under `.agents/` or `AGENTS.md`). CI changes use the `🎛 [ci]` type.
  - A commit that touches both backend and frontend takes the side that drives it, e.g. an API change plus its FE call sites is `backend`.
