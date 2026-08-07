# Timestamps and timezones

How kayman stores, transmits, and renders points in time. Applies across
backend and frontend.

## Storage (Postgres)

- Every timestamp column is `timestamptz` (`DateTime(timezone=True)`). Postgres
  normalizes to UTC on write. We never store naive/local wall-clock times.
- A timestamp must always have a **recoverable IANA timezone**, either:
  - persisted on the same row (e.g. `Event.timezone`), or
  - derivable from an associated entity (e.g. a `Transaction` uses its
    `Account.timezone`).
- The stored instant is absolute and immutable. The associated timezone exists
  for *display and grouping* (which calendar day / statement an instant falls
  in), not to alter the instant.

## Backend

- Accept timezone-aware datetimes (offset-aware ISO 8601). Pydantic parses these
  to an aware `datetime`; let Postgres normalize to UTC. Never treat an incoming
  value as naive local time.
- Reject or treat as a bug any timestamp arriving without offset/zone info.

## Client timezone

The frontend renders and inputs in the **client timezone**: the browser zone by
default, replaced by the user's saved override (Settings page, persisted in
`localStorage`).

- Read it with `useClientTimezone()`, which always resolves to a zone and also
  reports `isOverridden`.
- `BROWSER_TIMEZONE` is the provider's fallback, not a value call sites read on
  their own, and `Intl.DateTimeFormat().resolvedOptions().timeZone` never
  belongs in a component.
- The override is a display and input preference only. It relabels instants, it
  never rewrites stored ones.

## Frontend rendering

- Render in the **client timezone**.
- Optionally offer a switch to render in the entity's associated timezone
  (account zone for transactions). Note the consequence: with client-zone
  rendering, a transaction's calendar day and statement bucket follow the
  viewer's preference until the switch is used.

## Frontend create / edit

- The picker speaks the **client timezone**, which is the user's own clock, not
  necessarily the machine's. Picking Aug 7 12:00 AM with an `Asia/Taipei`
  override means Taipei midnight even when the browser sits in SF.
- Every wall-clock read and write goes through the Temporal helpers in
  `lib/utils.ts` (`formatTimePart`, `zonedCalendarDate`, `withDate`,
  `withTime`), which all take an explicit `timeZone`. Native `Date` getters
  (`getHours`, `getFullYear`) are hardcoded to the browser zone, so they must
  not drive the picker.
- When the associated entity's zone differs from the client zone, preview the
  same instant re-expressed in that zone (`toZonedISOString`, rendered by
  `ZonedTimePicker`) so the user sees which day/statement it lands in for the
  account.
- **Re-expressing in the associated zone is a relabel of the same instant, never
  a reschedule.** 2:00 PM SF = 5:00 PM NYC = 22:00 UTC are one instant with three
  labels. Sending `22:00Z`, `-07:00`, or `-04:00` all persist the identical row.
  Do not transpose the wall clock (do not turn "2 PM picked in SF" into "2 PM in
  NYC").

## Worked example

A user whose client timezone resolves to `America/Los_Angeles` creates a
transaction on an NYC account:

1. Picker shows the client zone. User picks 2:00 PM.
2. FE previews the account zone: 5:00 PM America/New_York (same instant).
3. FE sends that instant (offset-aware ISO in the account zone).
4. Postgres stores 22:00 UTC. Reads recover the zone from the account to render.

If that same user overrides their timezone to `Asia/Taipei`, step 1 changes
meaning: 2:00 PM now names Taipei 2:00 PM (06:00 UTC), and the preview line and
the stored row follow. The override changes which instant the input names. It
does not touch instants already stored.
