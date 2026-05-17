import {
  type ReactNode,
  useCallback,
  useMemo,
  useState
} from 'react'

import { AuthContext, type AuthContextValue, type AuthState } from '@/lib/auth-context'
import { login as apiLogin } from '@/lib/client'
import { type Client, createClient } from '@/lib/client/client'

const LOCAL_STORAGE_KEY = 'credential'

type StoredCredential = {
  host: string
  username: string
  accessToken: string
}

function loadCredential(): StoredCredential | null {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCredential>
    if (
      typeof parsed.host === 'string' &&
      typeof parsed.username === 'string' &&
      typeof parsed.accessToken === 'string'
    ) {
      return {
        host: parsed.host,
        username: parsed.username,
        accessToken: parsed.accessToken
      }
    }
  } catch {
    // fall through
  }
  return null
}

function clientFromCredential({ host, accessToken }: StoredCredential): Client {
  return createClient({ baseURL: host, auth: () => accessToken })
}

const EMPTY_STATE: AuthState = {
  host: '',
  username: '',
  accessToken: '',
  client: undefined
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = loadCredential()
    if (!stored) return EMPTY_STATE
    return { ...stored, client: clientFromCredential(stored) }
  })

  const login = useCallback(
    async (host: string, username: string, password: string) => {
      const client = createClient({ baseURL: host })
      const { data, error } = await apiLogin({
        client,
        body: { username, password }
      })
      if (error) throw new Error('Failed to authenticate')
      if (!data) throw new Error('No data returned')
      if (data.token_type !== 'bearer') {
        throw new Error(`Invalid token type: ${data.token_type}`)
      }
      const accessToken = data.access_token
      client.setConfig({ baseURL: host, auth: () => accessToken })

      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ host, username, accessToken } satisfies StoredCredential)
      )
      setState({ host, username, accessToken, client })
    },
    []
  )

  const logout = useCallback(() => {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    setState(EMPTY_STATE)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
