---
paths:
  - "frontend/src/components/ui/**"
---

# shadcn/ui components

- Don't modify files under `frontend/src/components/ui/`. The only allowed edits are syncing from shadcn upstream (e.g., re-running the `shadcn` CLI to pull a newer version).
- If a primitive needs project-specific behavior, wrap it in a new component elsewhere rather than editing the file in place.

Why: keeps these files in lockstep with shadcn upstream so future updates apply cleanly without diff conflicts.

Note: this is the current policy. It can be relaxed in the future as we see fit (e.g., if we decide to fork and own a specific primitive).
