import { type ClassValue, clsx } from 'clsx'
import { type DateRange } from 'react-day-picker'
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

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(browserLocale, {
    timeStyle: 'short'
  })
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

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatTimePart(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function withDate(value: Date, picked: Date) {
  const next = new Date(value)
  next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate())
  return next
}

export function withTime(value: Date, time: string) {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number)
  const next = new Date(value)
  next.setHours(h, m, s, 0)
  return next
}

export function isSameRange(a: DateRange | undefined, b: DateRange) {
  if (!a?.from || !a?.to) return false
  return (
    a.from.getTime() === b.from?.getTime() && a.to.getTime() === b.to?.getTime()
  )
}

// "GMT-5", "GMT+5:30", or "GMT" for the zone's current offset.
export function gmtLabel(timeZone: string): string {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value
  return name ?? 'GMT'
}

export function offsetMinutes(gmt: string): number {
  const match = gmt.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}
