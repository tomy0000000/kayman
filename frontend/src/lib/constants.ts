/**
 * The browser's current IANA timezone (e.g. "America/New_York"). This is only
 * the fallback: read the user's timezone with `useClientTimezone()` instead.
 */
export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
