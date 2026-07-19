import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'

import { App } from '@/app'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@/index.css'
import { AuthProvider } from '@/lib/auth'

function metaErrorMessage(meta: Record<string, unknown> | undefined) {
  return typeof meta?.errorMessage === 'string' ? meta.errorMessage : undefined
}

function notifyError(error: unknown, message: string) {
  console.error(error)
  toast.error(message, {
    id: message,
    description:
      error instanceof Error ? error.message : 'An unknown error occurred'
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
        <AuthProvider>
          <App queryClient={queryClient} />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)
