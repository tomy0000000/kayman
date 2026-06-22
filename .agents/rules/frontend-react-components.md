---
paths:
  - "frontend/src/**/*.tsx"
---

# React component file conventions

## Props interface at the top

Any component that takes props declares its props as an `interface <ComponentName>Props` at the top of the file, above the component itself. Destructure from the typed parameter:

```tsx
interface AccountCardProps {
  accountId: number
  onEdit: (id: number) => void
}

export function AccountCard({ accountId, onEdit }: AccountCardProps) { ... }
```

Why: keeps the public shape readable without scrolling, and gives a stable name to import for tests or wrappers.

## One public component per file

Each `.tsx` file exports exactly one React component. Additional components in the same file are allowed only if they are private (not exported) and used only within that file as implementation detail.

If a second component is reused elsewhere, move it to its own file.

## Reusable components live in `components/`

A component used in more than one route or feature belongs in `frontend/src/components/`. Route-local components stay colocated with the route file (either inline-private or as a sibling file under `routes/`).

## Utility functions live in `lib/utils.ts`

Pure helpers (formatters, date math, class-name builders, etc.) belong in `frontend/src/lib/utils.ts`, or a sibling module under `frontend/src/lib/` if the file grows unwieldy. A `.tsx` file should contain only its props interface and the component(s) it owns.

Why: keeps component files lean and focused on rendering, and makes helpers reusable and testable without mounting React.
