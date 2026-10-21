---
paths:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# TypeScript conventions

- No inline object type literals on function parameters. Declare a named `interface` (or `type`) above the function and annotate the parameter with it. This covers hook options, mutation variables, callback payloads and generic arguments alike.
- Comments only where the code cannot say it: a non-obvious why, one line. Never narrate what the code does.
