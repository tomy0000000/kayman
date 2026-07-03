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

## Frontend rendering

- Render in the **browser timezone** by default.
- Optionally offer a switch to render in the entity's associated timezone
  (account zone for transactions). Note the consequence: with browser-default
  rendering, a transaction's calendar day and statement bucket are
  viewer-dependent until the switch is used.

## Frontend create / edit

- The picker always reflects **browser local time**. The user inputs the instant
  as they experience it.
- When the associated entity's zone differs from the browser zone, preview the
  same instant re-expressed in that zone (e.g. `toZonedISOString`) so the user
  sees which day/statement it lands in for the account.
- **Re-expressing in the associated zone is a relabel of the same instant, never
  a reschedule.** 2:00 PM SF = 5:00 PM NYC = 22:00 UTC are one instant with three
  labels. Sending `22:00Z`, `-07:00`, or `-04:00` all persist the identical row.
  Do not transpose the wall clock (do not turn "2 PM picked in SF" into "2 PM in
  NYC").

## Worked example

A client in SF creates a transaction on an NYC account:

1. Picker shows SF local time. User picks 2:00 PM.
2. FE previews the account zone: 5:00 PM America/New_York (same instant).
3. FE sends that instant (offset-aware ISO in the account zone).
4. Postgres stores 22:00 UTC. Reads recover the zone from the account to render.
