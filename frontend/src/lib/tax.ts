import { type EventEntryDraft, componentKey } from '@/lib/types'
import { isAmount } from '@/lib/utils'

function minorDigits(currencyCode: string): number {
  return (
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode
    }).resolvedOptions().maximumFractionDigits ?? 2
  )
}

// Rows that can take tax in `currencyCode`, priced in minor units so nothing rounds.
function taxableRows(
  entries: EventEntryDraft[],
  currencyCode: string,
  untaxedKeys: Set<string>
) {
  const scale = 10 ** minorDigits(currencyCode)
  return entries.flatMap((entry) => {
    const quantity = parseInt(entry.quantity, 10)
    return entry.currencyCode === currencyCode &&
      !untaxedKeys.has(entry.key) &&
      isAmount(entry.amount) &&
      quantity >= 1
      ? [{ entry, quantity, unit: Math.round(Number(entry.amount) * scale) }]
      : []
  })
}

// The sum of the rows `spreadTax` would spread over, for showing the implied rate.
export function taxableSubtotal(
  entries: EventEntryDraft[],
  currencyCode: string,
  untaxedKeys: Set<string>
): number {
  const scale = 10 ** minorDigits(currencyCode)
  return (
    taxableRows(entries, currencyCode, untaxedKeys).reduce(
      (sum, row) => sum + row.unit * row.quantity,
      0
    ) / scale
  )
}

// Adds `tax` onto the taxable rows in proportion to their line totals, exact to the cent.
// See .agents/docs/tax-spread.md for the allocation walkthrough.
export function spreadTax(
  entries: EventEntryDraft[],
  tax: string,
  currencyCode: string,
  untaxedKeys: Set<string>
): EventEntryDraft[] | null {
  const digits = minorDigits(currencyCode)
  const scale = 10 ** digits
  const rows = taxableRows(entries, currencyCode, untaxedKeys)
  const base = rows.reduce((sum, row) => sum + row.unit * row.quantity, 0)
  if (!isAmount(tax) || rows.length === 0 || base === 0) return null

  const total = Math.round(Number(tax) * scale)
  // Units in a row share one price, so a row takes tax in steps of its quantity.
  const shares = rows.map((row, order) => {
    const raw = (total * row.unit * row.quantity) / base
    const perUnit = Math.floor((total * row.unit) / base)
    return { ...row, order, perUnit, remainder: raw - perUnit * row.quantity }
  })
  // Hand the cents lost to rounding down to the largest remainders first.
  let leftover = total - shares.reduce((s, r) => s + r.perUnit * r.quantity, 0)
  const byRemainder = [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.order - b.order
  )
  for (const share of byRemainder) {
    if (share.quantity > leftover) continue
    share.perUnit += 1
    leftover -= share.quantity
  }

  // Cents no quantity can absorb go to a qty-1 row, else to a unit split off.
  let split: { after: string; entry: EventEntryDraft } | null = null
  if (leftover > 0) {
    const single = byRemainder.find((share) => share.quantity === 1)
    if (single) {
      single.perUnit += leftover
    } else {
      const share = byRemainder[0]
      share.quantity -= 1
      split = {
        after: share.entry.key,
        entry: {
          ...share.entry,
          key: componentKey(),
          id: null,
          quantity: '1',
          amount: ((share.unit + share.perUnit + leftover) / scale).toFixed(
            digits
          )
        }
      }
    }
  }

  const byKey = new Map(shares.map((share) => [share.entry.key, share]))
  return entries.flatMap((entry) => {
    const share = byKey.get(entry.key)
    if (!share) return [entry]
    const taxed = {
      ...entry,
      quantity: String(share.quantity),
      amount: ((share.unit + share.perUnit) / scale).toFixed(digits)
    }
    return split?.after === entry.key ? [taxed, split.entry] : [taxed]
  })
}
