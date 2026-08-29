import { type ReactNode, useCallback, useMemo, useState } from 'react'

import {
  ClientCurrencyContext,
  type ClientCurrencyContextValue
} from '@/lib/client-currency-context'

const LOCAL_STORAGE_KEY = 'client_currency'

export function ClientCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string | null>(() =>
    window.localStorage.getItem(LOCAL_STORAGE_KEY)
  )

  const setCurrency = useCallback((currency: string) => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, currency)
    setCurrencyState(currency)
  }, [])

  const reset = useCallback(() => {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    setCurrencyState(null)
  }, [])

  const value = useMemo<ClientCurrencyContextValue>(
    () => ({ currency, setCurrency, reset }),
    [currency, setCurrency, reset]
  )

  return (
    <ClientCurrencyContext.Provider value={value}>
      {children}
    </ClientCurrencyContext.Provider>
  )
}
