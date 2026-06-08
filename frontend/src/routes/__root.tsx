import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Suspense, lazy, useEffect, useState } from 'react'

import { Toaster } from '@/components/ui/sonner'
import type { useAuth } from '@/hooks/use-auth'

declare global {
  interface Window {
    toggleDevtools: () => void
  }
}

interface RouterContext {
  queryClient: QueryClient
  auth: ReturnType<typeof useAuth>
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout
})

const ReactQueryDevtoolsProduction = lazy(() =>
  import('@tanstack/react-query-devtools/build/modern/production.js').then(
    (d) => ({
      default: d.ReactQueryDevtools
    })
  )
)

function RootLayout() {
  const [showDevtools, setShowDevtools] = useState(false)

  useEffect(() => {
    window.toggleDevtools = () => setShowDevtools((old) => !old)
  }, [])

  return (
    <>
      <Outlet />
      <Toaster />
      <TanStackRouterDevtools position="bottom-right" />
      {showDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtoolsProduction />
        </Suspense>
      )}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
    </>
  )
}
