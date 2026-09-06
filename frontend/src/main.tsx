import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app'
import { toast } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@/index.css'
import { AuthProvider } from '@/lib/auth'
import type { ValidationError } from '@/lib/client'
import { ClientCurrencyProvider } from '@/lib/client-currency'
import { ClientTimezoneProvider } from '@/lib/client-timezone'

function metaErrorMessage(meta: Record<string, unknown> | undefined) {
  return typeof meta?.errorMessage === 'string' ? meta.errorMessage : undefined
}

// The reason the backend gives, which is far more useful than axios' generic
// "Request failed with status code 409". FastAPI puts it in `detail`: a string
// from HTTPException, a list of per-field objects from request validation.
function backendDetail(error: unknown) {
  if (!isAxiosError(error)) {
    return undefined
  }
  const { detail } = (error.response?.data ?? {}) as { detail?: unknown }
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as ValidationError[]).map((item) => item.msg).join(', ')
  }
  return undefined
}

function notifyError(error: unknown, message: string) {
  console.error(error)
  toast.add({
    // Same id for the same failure, so a retry updates the toast in place
    // instead of stacking duplicates.
    id: message,
    type: 'error',
    title: message,
    description:
      backendDetail(error) ??
      (error instanceof Error ? error.message : 'An unknown error occurred')
  })
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) =>
      notifyError(error, metaErrorMessage(query.meta) ?? 'Failed to load data')
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      notifyError(
        error,
        metaErrorMessage(mutation.meta) ?? 'Something went wrong'
      )
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClientTimezoneProvider>
          <ClientCurrencyProvider>
            <AuthProvider>
              <App queryClient={queryClient} />
            </AuthProvider>
          </ClientCurrencyProvider>
        </ClientTimezoneProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)
