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

## Data hooks in `components/`

Components in `frontend/src/components/` default to presentational: data and mutation handlers arrive through props.

- Page-level data (lists a route loads once and shares, e.g. accounts, categories, currencies) is fetched in route files under `frontend/src/routes/`, or in a component colocated with its route, then passed down as props.
- Mutations always stay route-owned. The route decides what happens after success (invalidation, navigation, closing a sheet), so components receive submit callbacks and pending flags via props. No `useMutation` or `useQueryClient` in `components/`.

Exception: a component may own a `useQuery` when the query key depends on the component's own internal state (a search input, a selection, pagination inside the widget). Hoisting such a query would force the route to track the widget's internal state, which is worse than the hook. Example: `link-transactions-table.tsx` fetching unlinked transactions keyed on its own selected account.

- These queries use a shared `queryOptions` factory from `frontend/src/lib/` rather than an inline key, so each key is defined in one place and dedupes with any other caller.

Why: TanStack Query dedupes on the query key, not the call site, so ownership lives in the key. Keeping page data and mutations at the route keeps loading states and post-submit behavior in one place, while the exception avoids lifting widget-internal state into routes. Tests render shared components with a small `QueryClientProvider` wrapper when a query is involved.
