# CLAUDE.md

Guidance for the Kayman frontend. See the repo-root `CLAUDE.md` for cross-cutting context (toolchain, one-time setup, docker, end-to-end request flow).

## Stack

- TypeScript
- React 19
- Vite
- TanStack Router
- TanStack Query
- Tailwind v4
- shadcn
- Managed with `pnpm`

## Common commands

Run from the repo root. Tasks change into `frontend/` automatically.

```bash
mise run start:frontend        # vite dev server
mise run lint:frontend         # eslint
mise run format:frontend       # prettier -w .
mise run build:frontend        # tsc -b && vite build
```

There is no frontend test suite.

### Codegen

The API client and route tree are generated, not hand-written.

```bash
mise run build:openapi-client  # regenerate src/lib/client/ from the backend's OpenAPI spec
mise run build:router          # regenerate src/routeTree.gen.ts
```

Regenerate the client whenever backend routes or schemas change. The router tree is also generated automatically by the `tanstackRouter` Vite plugin during dev.

## Architecture (`frontend/src/`)

- `main.tsx`: wires `QueryClientProvider`, `TooltipProvider`, `AuthProvider`, then `<App>`.
- `app.tsx`: creates the TanStack Router with `{ queryClient, auth }` context.
- `routes/`: file-based routes (TanStack Router). `_authenticated.*` routes require auth. **`routeTree.gen.ts` is generated, never edit it.**
- `lib/client/`: generated OpenAPI client (axios). **Generated, never edit by hand.** Import API calls from here.
- `lib/auth.tsx` / `lib/auth-context.ts` / `hooks/use-auth.ts`: auth context wiring used as router context.
- `components/ui/`: shadcn components. Other top-level `components/*.tsx` are app-specific.
- Path alias: `@/` → `frontend/src/`.
- React Compiler is enabled via `@rolldown/plugin-babel` + `reactCompilerPreset()` in `vite.config.ts`.
- `envPrefix` allows `VITE_*` and `ENVIRONMENT` env vars to reach the client.

## Conventions

- Don't hand-edit `src/routeTree.gen.ts` or anything under `src/lib/client/`. Regenerate via `mise run build:router` / `mise run build:openapi-client`.
- Form labels should use `FieldLabel` from `@/components/ui/field`, not the lower-level `Label`.
