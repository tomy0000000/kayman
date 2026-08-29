import { createContext } from 'react'

export type ClientCurrencyContextValue = {
  /**
   * The ISO 4217 code to default currency inputs to, or null when the user
   * hasn't picked one in Settings.
   */
  currency: string | null
  setCurrency: (currency: string) => void
  reset: () => void
}

export const ClientCurrencyContext =
  createContext<ClientCurrencyContextValue | null>(null)
