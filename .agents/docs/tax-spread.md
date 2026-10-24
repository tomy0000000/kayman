# Tax spread

Design record, 2026-10-24. Implemented in `frontend/src/lib/tax.ts` and wired
into the event form's entries table (`event-entries-field.tsx`).

## Problem

A receipt lists items (often at a discounted net price), some taxable and some
not, then one tax line for the whole purchase. Kayman has no tax field, so the
tax has to land inside the entry amounts. Otherwise the entries never add up
to the transaction total, and category spending leaves the tax out.

## Decisions

- **Tax is not stored.** A spread rewrites entry amounts to include tax. The
  tax figure and the pre-tax price are gone after save. No backend change.
- **Taxable is form-only.** Each row has a "Tax" toggle while a tax is being
  entered. It is not saved, and it does not live on the category.
- **Discounts go in as a net price on one row.** The spread does not look for
  separate discount rows.
- **The tax currency locks on first input.** It defaults to the last entry's
  currency, then stays fixed until the tax field is cleared. Only rows in that
  currency take tax.

## Allocation

All math runs in integer minor units (cents), with the number of decimals taken
from `Intl.NumberFormat` for the currency, so JPY has none. Floating point only
appears in the remainders used for ordering.

1. **Weights:** each taxable row weighs its line total, `unit price × quantity`.
   The base is the sum of all weights.
2. **Floor:** a row's raw share is `tax × weight / base`. Units in one row share
   one price, so the row takes tax per unit: `floor(tax × unit / base)`.
3. **Largest remainder:** the cents lost to flooring go out one step at a time
   to rows sorted by remainder, largest first, ties by row order. A row with
   quantity `n` needs `n` cents for one more cent per unit, so it is skipped
   when fewer than `n` cents are left.
4. **Residue:** any cents still left go entirely to a quantity-1 row. If no
   such row exists, one unit is split off the top-remainder row into a new
   quantity-1 row that carries the extra cents.

The result sums to `subtotal + tax` exactly.

## Worked example

Costco receipt: three taxable items at net prices, tax $3.45.

| Entry      | Pre-tax | Raw share | Floor | +Remainder | Final     |
| ---------- | ------- | --------- | ----- | ---------- | --------- |
| Pantene SH | 9.99    | 0.8623    | 0.86  |            | 10.85     |
| Pantene CN | 9.99    | 0.8623    | 0.86  |            | 10.85     |
| Native BW  | 19.99   | 1.7254    | 1.72  | +0.01      | 21.72     |
| **Total**  | 39.97   |           | 3.44  |            | **43.42** |

Quantity case: one row of 2 × $5.00 with tax $0.87. Each unit can only take
whole cents, and 87 is odd, so the row splits into 5.43 × 1 and 5.44 × 1.

## UI flow

The footer shows Subtotal, then the Tax input with Spread, then Total with the
tax added. The Tax row also shows the implied rate (`tax / taxable subtotal`)
as a typo check. After Spread, the Subtotal row hides and the Tax row reads
"… tax spread across the taxable entries" with Undo. Any later edit to the
entries drops Undo, because its snapshot is stale.
