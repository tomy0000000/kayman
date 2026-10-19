---
paths:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# API access

- Never call the raw HTTP client (`client.get`/`client.post`/`client.put`/`client.delete` with a `url`). Use the generated, typed API method instead, e.g. `readAccounts({ client })`, `createTransaction({ client, body })`.
- The generated methods live in `@/lib/client` (the SDK compiled from the OpenAPI spec). If a method you need doesn't exist, regenerate the client rather than hand-rolling a raw request.

Why: the compiled methods carry the correct path, HTTP verb, request/response types, and auth/security config. Hand-written `client.post({ url, ... })` calls duplicate that wiring, drift from the backend contract, and lose type safety.

## Fetching and mutating in components

- Use the generated TanStack Query helpers, not hand-written `useQuery({ queryKey, queryFn })`. The `@tanstack/react-query` plugin (in `openapi-ts.config.ts`) emits `<operation>Options`, `<operation>Mutation`, and `<operation>QueryKey` for every endpoint in `@/lib/client/@tanstack/react-query.gen`.
  - Query: `useQuery(readAccountsOptions())`, or `useQuery({ ...readEventsOptions({ query }), enabled })` to add options.
  - Mutation: `useMutation({ ...createAccountMutation(), onSuccess })`.
  - Invalidate: `queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })`. A key builder called with no or partial args partial-matches every variant of that operation.
- Don't pass `client` to the generated helpers or key builders. The single generated client singleton is configured at login (`client.setConfig` in `lib/auth.tsx`), so every key shares one `baseURL` and invalidation matches. Passing a stray client desyncs the key's `baseURL` and silently breaks invalidation.
- Don't unwrap `{ data, error }` by hand. `*Options`/`*Mutation` already throw on error and return `data`. For imperative SDK calls inside a `mutationFn`, pass `throwOnError: true` and destructure `{ data }`.
- Don't add per-query error `useEffect`s or mutation `onError` toasts. Error toasting is centralized in `main.tsx` (`QueryCache`/`MutationCache` `onError`). Set `meta: { errorMessage: '...' }` on the query or mutation to customize the toast title; otherwise a generic message shows.

Why: the generated helpers erase the repeated queryFn/key/unwrap boilerplate and keep query keys structured, so caching and invalidation are correct by construction. One configured client and one error handler keep call sites carrying data logic only.

## Enum values

- Backend enums arrive as `SCREAMING_SNAKE_CASE` string unions (`'EXPENSE'`, `'CREDIT_CARD'`). Compare and store the raw value; never render it directly. Map it to a display label through a `{ value, label }` table in `lib/` (see `lib/account-types.ts`, `lib/event-types.ts`).

## Optimistic updates

Every mutation renders its expected outcome first and only reverts if the request fails. Users never wait on the server to see their own action. Follow the official TanStack Query guide (https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), which has two approaches; pick by how many places on screen show the result.

**Via the UI** (default; the result shows in one place, e.g. a list on the same page as its FAB):

- Read `variables`, `isPending` and `isError` from `useMutation` and render a temporary row from `variables` while pending (dimmed, e.g. `opacity-50`). No cache write, no rollback.
- Return the `invalidateQueries` promise from `onSettled`, so the mutation stays pending until the refetch lands and the real row replaces the temporary one.
- On `isError`, keep the row in an error style with a Retry control that calls `mutate(variables)`; `variables` survive the failure, so the user's input is never lost.
- Use the helpers in `lib/optimistic.ts` and `components/optimistic-item.tsx` rather than writing this by hand at each site:
  - `useOptimisticMutation(options, queryKeys)` wraps `useMutation`, invalidates `queryKeys` on settle (returned, so pending lasts through the refetch) and exposes `optimistic` (`{ variables, status, retry }` or `null`).
  - `withOptimisticRow(items, keyOf, optimistic, toRow, compare?)` merges the optimistic row into the list, keyed and sorted. `toRow` maps `variables` to the narrow type the row renders, so server-assigned fields are not faked.
  - `<OptimisticItem status onRetry>` as the row's root: dimmed and inert while pending, error-styled with a Retry button once failed, plain otherwise.
- If the mutation and the list live in different components, give the mutation a `mutationKey` and read pending variables with `useMutationState({ filters: { mutationKey, status: 'pending' }, select: (m) => m.state.variables })`.
- The reference example is statement creation in `routes/_auth/account/$id/statement.tsx`.

**Via the cache** (several components read the same data, e.g. an event shown in a table and a receipt sheet):

- `onMutate`: `await queryClient.cancelQueries({ queryKey })`, snapshot with `getQueryData`, write the prediction with `setQueryData`, return the snapshot as context.
- `onError`: restore the snapshot from the context.
- `onSettled`: `invalidateQueries` for the same key.
- Write it inline in the `useMutation` call as the guide shows; no shared wrapper.

Either way: close the sheet or dialog when the mutation fires, not in `onSuccess`; keep the success toast in `onSuccess`; never add a per-mutation error toast (the centralized `MutationCache` `onError` in `main.tsx` reports via `meta.errorMessage`).

Why: the backend lives far from the browser and every form round-trips several calls (event + transactions + entries). Waiting on each one makes the app feel slow; rendering first and reverting on failure keeps it instant while still never showing state the server rejected.
