import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  AuthContext,
  type AuthContextValue,
  type AuthState
} from '@/lib/auth-context'
import {
  login as apiLogin,
  refreshToken as apiRefreshToken
} from '@/lib/client'
import { type Client } from '@/lib/client/client'
import { client } from '@/lib/client/client.gen'

const LOCAL_STORAGE_KEY = 'credential'
const REFRESH_LEAD_MS = 5 * 60 * 1000
const REFRESH_RETRY_MS = 30 * 1000

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

function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

function clientFromCredential({ host, accessToken }: StoredCredential): Client {
  client.setConfig({ baseURL: host, auth: () => accessToken })
  return client
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

  const logout = useCallback(() => {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    setState(EMPTY_STATE)
  }, [])

  const logoutRef = useRef(logout)
  useEffect(() => {
    logoutRef.current = logout
  }, [logout])

  useEffect(() => {
    const client = state.client
    if (!client) return
    const id = client.instance.interceptors.response.use(undefined, (error) => {
      if (error?.response?.status === 401) {
        sessionStorage.setItem('logout_reason', 'session_expired')
        logoutRef.current()
      }
      return Promise.reject(error)
    })
    return () => {
      client.instance.interceptors.response.eject(id)
    }
  }, [state.client])

  useEffect(() => {
    const { host, username, accessToken, client } = state
    if (!client) return
    const expiresAt = tokenExpiresAt(accessToken)
    if (expiresAt === null) return
    let cancelled = false
    let timer: number | undefined
    const schedule = (delay: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, delay)
    }
    const refresh = async () => {
      const result = await apiRefreshToken({ client })
      if (cancelled) return
      const { data } = result
      if (!data) {
        // A 401 already logged out via the interceptor, so retry only other failures.
        const status = 'response' in result ? result.response?.status : null
        if (status !== 401 && Date.now() < expiresAt) {
          schedule(REFRESH_RETRY_MS)
        }
        return
      }
      const next = { host, username, accessToken: data.access_token }
      client.setConfig({ baseURL: host, auth: () => next.accessToken })
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next))
      setState({ ...next, client })
    }
    // Timers stall while the machine sleeps, so recheck on wake.
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        expiresAt - Date.now() < REFRESH_LEAD_MS
      ) {
        schedule(0)
      }
    }
    schedule(Math.max(expiresAt - REFRESH_LEAD_MS - Date.now(), 0))
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state])

  const login = useCallback(
    async (host: string, username: string, password: string) => {
      client.setConfig({ baseURL: host })
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
        JSON.stringify({
          host,
          username,
          accessToken
        } satisfies StoredCredential)
      )
      setState({ host, username, accessToken, client })
    },
    []
  )

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
