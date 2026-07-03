import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Temporal } from 'temporal-polyfill'

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

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(browserLocale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function toLocalDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19)
}

// Short rendering of the instant `date` as seen in `timeZone` (a IANA name),
// e.g. "Jul 1 11:00" (no year, no seconds). For display only; use
// `toZonedISOString` for anything that goes to the API.
export function formatZonedDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(browserLocale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('month')} ${get('day')} ${get('hour')}:${get('minute')}`
}

// Re-express the instant `date` represents in `timeZone` (a IANA name) as an
// offset-aware ISO 8601 string. The same moment picked as 8:00 in PT becomes
// 11:00-04:00 for an ET account.
export function toZonedISOString(date: Date, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timeZone)
    .toString({ timeZoneName: 'never', fractionalSecondDigits: 0 })
}
