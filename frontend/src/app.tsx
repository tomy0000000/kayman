import type { QueryClient } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { useAuth } from '@/hooks/use-auth'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: {
    queryClient: undefined!,
    auth: undefined!
  },
  defaultPreload: 'intent',
  scrollRestoration: true
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function App({ queryClient }: { queryClient: QueryClient }) {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ queryClient, auth }} />
}
