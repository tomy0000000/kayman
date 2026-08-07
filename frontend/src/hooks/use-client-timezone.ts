import { useContext } from 'react'

import {
  ClientTimezoneContext,
  type ClientTimezoneContextValue
} from '@/lib/client-timezone-context'

export function useClientTimezone(): ClientTimezoneContextValue {
  const ctx = useContext(ClientTimezoneContext)
  if (!ctx)
    throw new Error(
      'useClientTimezone must be used within a ClientTimezoneProvider'
    )
  return ctx
}
