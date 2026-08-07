import { type ReactNode, useCallback, useMemo, useState } from 'react'

import {
  ClientTimezoneContext,
  type ClientTimezoneContextValue
} from '@/lib/client-timezone-context'
import { CLIENT_TIMEZONE } from '@/lib/constants'

const LOCAL_STORAGE_KEY = 'client_timezone'

// Returns the canonical form of the stored zone, or null when nothing is stored
// or the stored value isn't a zone Intl recognizes.
function loadTimezone(): string | null {
  const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!stored) return null
  try {
    return Intl.DateTimeFormat(undefined, {
      timeZone: stored
    }).resolvedOptions().timeZone
  } catch {
    return null
  }
}

export function ClientTimezoneProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<string | null>(loadTimezone)

  const setTimezone = useCallback((timezone: string) => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, timezone)
    setOverride(timezone)
  }, [])

  const reset = useCallback(() => {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    setOverride(null)
  }, [])

  const value = useMemo<ClientTimezoneContextValue>(
    () => ({
      timezone: override ?? CLIENT_TIMEZONE,
      isOverridden: override !== null,
      setTimezone,
      reset
    }),
    [override, setTimezone, reset]
  )

  return (
    <ClientTimezoneContext.Provider value={value}>
      {children}
    </ClientTimezoneContext.Provider>
  )
}
