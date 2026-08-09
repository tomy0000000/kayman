import { type ClassValue, clsx } from 'clsx'
import { type DateRange } from 'react-day-picker'
import { twMerge } from 'tailwind-merge'
import { Temporal } from 'temporal-polyfill'

const browserLocale =
  typeof navigator !== 'undefined' ? navigator.language : undefined

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// The amount input is free text, so a half-typed value like `-` or `.` reads as
// non-empty while being unparseable.
export function isAmount(value: string): boolean {
  return value !== '' && !Number.isNaN(Number(value))
}

export function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(browserLocale, {
    style: 'currency',
    currency: currencyCode
  }).format(amount)
}

export function formatDateTime(value: string | Date, timeZone: string): string {
  return new Date(value).toLocaleString(browserLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone
  })
}

export function formatDate(value: string | Date, timeZone: string): string {
  return new Date(value).toLocaleDateString(browserLocale, { timeZone })
}

export function formatTime(value: string | Date, timeZone: string): string {
  return new Date(value).toLocaleTimeString(browserLocale, {
    timeStyle: 'short',
    timeZone
  })
}

// Short rendering of the instant `date` as seen in `timeZone` (a IANA name),
// e.g. "Jul 1, 11:00" (no year, no seconds). For display only, use
// `toZonedISOString` for anything that goes to the API.
export function formatZonedDateTime(date: Date, timeZone: string): string {
  return date.toLocaleString(browserLocale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  })
}

// The instant `date` read as a wall clock in `timeZone`. Every wall-clock read
// and write below goes through this, so the user's timezone drives them rather
// than the browser's.
function zoned(date: Date, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(
    date.getTime()
  ).toZonedDateTimeISO(timeZone)
}

// Re-express the instant `date` represents in `timeZone` (a IANA name) as an
// offset-aware ISO 8601 string. The same moment picked as 8:00 in PT becomes
// 11:00-04:00 for an ET account.
export function toZonedISOString(date: Date, timeZone: string) {
  return zoned(date, timeZone).toString({
    timeZoneName: 'never',
    fractionalSecondDigits: 0
  })
}

// Parse a "YYYY-MM-DD" string into a Date at local midnight (inverse of
// `formatCalendarDate`). Avoids the UTC shift of `new Date(value)`.
export function parseLocalDate(value: string): Date {
  const [y = 0, m = 1, d = 1] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// The calendar day a `zonedCalendarDate` stand-in names, read back through the
// same browser-local getters that produced it.
function calendarPlainDate(picked: Date) {
  return Temporal.PlainDate.from({
    year: picked.getFullYear(),
    month: picked.getMonth() + 1,
    day: picked.getDate()
  })
}

// "YYYY-MM-DD" for the day a `zonedCalendarDate` stand-in names, the inverse of
// `parseLocalDate`. This is the form the `date` search param takes.
export function formatCalendarDate(picked: Date): string {
  return calendarPlainDate(picked).toString()
}

// "HH:MM:SS" of the instant `date` as read in `timeZone`.
export function formatTimePart(date: Date, timeZone: string) {
  return zoned(date, timeZone)
    .toPlainTime()
    .toString({ smallestUnit: 'second' })
}

// react-day-picker and date-fns read a Date's Y/M/D with browser-local getters,
// so hand them a stand-in whose *local* calendar day is the day `date` falls on
// in `timeZone`. For display and selection only: never store this instant.
export function zonedCalendarDate(date: Date, timeZone: string) {
  const { year, month, day } = zoned(date, timeZone)
  return new Date(year, month - 1, day)
}

// The half-open instant range covering the calendar day `picked` names (a
// `zonedCalendarDate` stand-in), as that day runs in `timeZone`. Aug 5 in
// Taipei is [2026-08-04T16:00Z, 2026-08-05T16:00Z).
export function zonedDayRange(picked: Date, timeZone: string) {
  const start = calendarPlainDate(picked).toZonedDateTime(timeZone)
  return {
    start: new Date(start.epochMilliseconds).toISOString(),
    end: new Date(start.add({ days: 1 }).epochMilliseconds).toISOString()
  }
}

// The half-open instant range covering the calendar month `picked` falls in (a
// `zonedCalendarDate` stand-in), as that month runs in `timeZone`. August in
// Taipei is [2026-07-31T16:00Z, 2026-08-31T16:00Z).
export function zonedMonthRange(picked: Date, timeZone: string) {
  const start = calendarPlainDate(picked)
    .with({ day: 1 })
    .toZonedDateTime(timeZone)
  return {
    start: new Date(start.epochMilliseconds).toISOString(),
    end: new Date(start.add({ months: 1 }).epochMilliseconds).toISOString()
  }
}

// Move `value` to the calendar day `picked` names (a `zonedCalendarDate`
// stand-in), keeping its wall-clock time in `timeZone`.
export function withDate(value: Date, picked: Date, timeZone: string) {
  const next = zoned(value, timeZone).with({
    year: picked.getFullYear(),
    month: picked.getMonth() + 1,
    day: picked.getDate()
  })
  return new Date(next.epochMilliseconds)
}

// Set the wall-clock time of `value` as read in `timeZone`.
export function withTime(value: Date, time: string, timeZone: string) {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number)
  const next = zoned(value, timeZone).with({
    hour: h,
    minute: m,
    second: s,
    millisecond: 0
  })
  return new Date(next.epochMilliseconds)
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

// The zone's current offset from UTC, in minutes.
export function offsetMinutes(timeZone: string): number {
  return (
    Temporal.Now.zonedDateTimeISO(timeZone).offsetNanoseconds / 60_000_000_000
  )
}
