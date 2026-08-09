/**
 * The browser's current IANA timezone (e.g. "America/New_York"). This is only
 * the fallback: read the user's timezone with `useClientTimezone()` instead.
 */
export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * staleTime for reference data the frontend never mutates (categories,
 * currencies, transaction tags), so navigating between routes reuses the
 * cached lists instead of refetching. Not for accounts: their balance
 * changes with every transaction mutation.
 */
export const REFERENCE_STALE_TIME = 5 * 60 * 1000
