import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@/index.css'
import { AuthProvider } from '@/lib/auth'

const queryClient = new QueryClient()

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
