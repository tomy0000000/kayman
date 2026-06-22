import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const browserLocale =
  typeof navigator !== 'undefined' ? navigator.language : undefined

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(browserLocale, {
    style: 'currency',
    currency: currencyCode
  }).format(amount)
}

// `end` is exclusive (half-open interval), so callers pass the start of the day
// after the picked end date to include all transactions on that day.
export function endExclusive(date: Date | undefined): string | null {
  if (!date) return null
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return next.toISOString()
}

export function toLocalDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19)
}
