import { createContext } from 'react'

export type ClientTimezoneContextValue = {
  /** The IANA timezone to treat as the user's own. Always resolved. */
  timezone: string
  /** False while `timezone` is just whatever the browser reports. */
  isOverridden: boolean
  setTimezone: (timezone: string) => void
  reset: () => void
}

export const ClientTimezoneContext =
  createContext<ClientTimezoneContextValue | null>(null)
