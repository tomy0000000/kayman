---
paths:
  - "frontend/src/**/*.tsx"
---

# React component file conventions

## Props interface at the top

Any component that takes props declares its props as an `interface <ComponentName>Props` at the top of the file, above the components themselves. This applies to every component in the file, exported or not. Destructure from the typed parameter.

When a file has multiple components, list the interfaces in the same order as the component functions that use them:

```tsx
interface AccountCardProps {
  accountId: number
  onEdit: (id: number) => void
}

interface AccountBadgeProps {
  status: AccountStatus
}

export function AccountCard({ accountId, onEdit }: AccountCardProps) { ... }

function AccountBadge({ status }: AccountBadgeProps) { ... }
```

Why: keeps the props shapes readable without scrolling, and gives each a stable name to import for tests or wrappers. Matching the interface order to the component order makes the pairing obvious at a glance.

## One public component per file

Each `.tsx` file exports exactly one React component. Additional components in the same file are allowed only if they are private (not exported) and used only within that file as implementation detail.

If a second component is reused elsewhere, move it to its own file.

## Reusable components live in `components/`

A component used in more than one route or feature belongs in `frontend/src/components/`. Route-local components stay colocated with the route file (either inline-private or as a sibling file under `routes/`).

## Utility functions live in `lib/utils.ts`

Pure helpers (formatters, date math, class-name builders, etc.) belong in `frontend/src/lib/utils.ts`, or a sibling module under `frontend/src/lib/` if the file grows unwieldy. A `.tsx` file should contain only its props interface and the component(s) it owns.

Why: keeps component files lean and focused on rendering, and makes helpers reusable and testable without mounting React.

## No data hooks in `components/`

Components in `frontend/src/components/` are pure presentational: no `useQuery`, `useMutation`, `useSuspenseQuery`, or `useQueryClient`. Data and mutation handlers arrive through props.

- Queries and mutations belong in route files under `frontend/src/routes/`, or in a component colocated with its route. The route fetches, then passes the data (and any submit/mutate callbacks) down as props.
- A reusable widget that renders server data (e.g. a select populated from an API) still receives that data via props. The caller owns the query, so the cache stays deduped at the route boundary.

Why: shared components render in tests without a `QueryClientProvider` or network, and each piece of data has one obvious owner instead of being fetched wherever it happens to be displayed.
