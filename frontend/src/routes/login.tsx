import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { useAuth } from '@/hooks/use-auth'

const LOCAL_BACKEND: string = 'http://localhost:8000'
const PRESET_HOSTS: Record<string, string> = {
  'Local Backend': LOCAL_BACKEND
}

const searchSchema = z.object({
  redirect: z.string().optional()
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.client) {
      throw redirect({ to: search.redirect ?? '/' })
    }
  },
  component: LoginPage
})

function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const search = Route.useSearch()

  const [host, setHost] = useState(() => {
    if (import.meta.env.ENVIRONMENT === 'local') return LOCAL_BACKEND
    if (typeof window !== 'undefined') return window.location.origin
    return LOCAL_BACKEND
  })
  const [hostPickerOpen, setHostPickerOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('logout_reason') === 'session_expired') {
      sessionStorage.removeItem('logout_reason')
      setSessionExpired(true)
    }
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await auth.login(host, username, password)
      navigate({ to: search.redirect ?? '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4 p-8">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {sessionExpired && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            You were signed out due to inactivity. Please sign in again.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Collapsible className="space-y-2">
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-sm">
          Advanced
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Popover open={hostPickerOpen} onOpenChange={setHostPickerOpen}>
            <PopoverAnchor asChild>
              <InputGroup>
                <InputGroupInput
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <PopoverTrigger asChild>
                    <InputGroupButton
                      size="icon-xs"
                      aria-label="Choose a preset host"
                    >
                      <ChevronDown />
                    </InputGroupButton>
                  </PopoverTrigger>
                </InputGroupAddon>
              </InputGroup>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              className="flex w-(--radix-popover-trigger-width) flex-col gap-0 p-1"
            >
              {Object.entries(PRESET_HOSTS).map(([label, url]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setHost(url)
                    setHostPickerOpen(false)
                  }}
                  className="hover:bg-accent hover:text-accent-foreground flex items-center rounded-sm px-2 py-1.5 text-sm outline-hidden"
                >
                  <span>{label}</span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {url}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </CollapsibleContent>
      </Collapsible>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
