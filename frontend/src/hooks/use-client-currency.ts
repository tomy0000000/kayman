import { useContext } from 'react'

import {
  ClientCurrencyContext,
  type ClientCurrencyContextValue
} from '@/lib/client-currency-context'

export function useClientCurrency(): ClientCurrencyContextValue {
  const ctx = useContext(ClientCurrencyContext)
  if (!ctx)
    throw new Error(
      'useClientCurrency must be used within a ClientCurrencyProvider'
    )
  return ctx
}
