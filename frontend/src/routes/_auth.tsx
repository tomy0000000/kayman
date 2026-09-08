import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.client) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href }
      })
    }
    return { client: context.auth.client }
  },
  component: AuthenticatedLayout
})

function AuthenticatedLayout() {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-[calc(3rem+var(--spacing-safe-t))] shrink-0 items-center gap-2 border-b px-4 pt-safe-t">
          <SidebarTrigger />
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pb-[max(var(--spacing-safe-b),1rem)]">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
