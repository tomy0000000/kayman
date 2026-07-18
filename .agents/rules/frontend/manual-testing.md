---
paths:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# Manual / browser testing

- Do not perform browser or manual UI testing on your own. Verify frontend work
  by other means (typecheck, lint, reading code) unless the user explicitly asks
  you to test in the browser.
- When the user does ask for browser testing, the frontend dev server is at
  `localhost:5173`. It is behind basic auth: both the username and the password
  are a single space character (`" "`).

Why: browser testing is slow and side-effectful, and the user wants to opt into
it deliberately rather than have it run by default.
