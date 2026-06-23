---
paths:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# API access

- Never call the raw HTTP client (`client.get`/`client.post`/`client.put`/`client.delete` with a `url`). Use the generated, typed API method instead, e.g. `readAccounts({ client })`, `createTransaction({ client, body })`.
- The generated methods live in `@/lib/client` (the SDK compiled from the OpenAPI spec). If a method you need doesn't exist, regenerate the client rather than hand-rolling a raw request.

Why: the compiled methods carry the correct path, HTTP verb, request/response types, and auth/security config. Hand-written `client.post({ url, ... })` calls duplicate that wiring, drift from the backend contract, and lose type safety.
