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
