---
paths:
  - "frontend/src/**/*.tsx"
---

# Long text

- When rendering text whose length the user or the data controls (descriptions, notes, names, category labels), decide whether it should truncate. Don't let it widen its container by default.
- In tables, truncate with `truncate` on the text and `table-fixed` plus column widths on the `Table`, as `events-table.tsx` and `transactions-table.tsx` do. Table cells are `whitespace-nowrap`, so unbounded text stretches the whole row.
- Keep text whole where reading all of it is the point (detail views, forms). Truncating there hides content with no other way to see it.

Why: real data is longer than mock data, and one long description can push a table's amount column off screen.
