import { createContext } from 'react'

import type { Client } from '@/lib/client/client'

export type AuthState = {
  host: string
  username: string
  accessToken: string
  client: Client | undefined
}

export type AuthContextValue = AuthState & {
  login: (host: string, username: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
