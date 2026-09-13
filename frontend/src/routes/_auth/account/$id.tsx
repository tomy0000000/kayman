import {
  Link,
  Outlet,
  createFileRoute,
  useLocation
} from '@tanstack/react-router'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'overview', label: 'Overview', to: '/account/$id' },
  {
    value: 'transaction',
    label: 'Transactions',
    to: '/account/$id/transaction'
  },
  { value: 'statement', label: 'Statements', to: '/account/$id/statement' }
] as const

export const Route = createFileRoute('/_auth/account/$id')({
  component: AccountLayout
})

function AccountLayout() {
  const { id } = Route.useParams()
  const { pathname } = useLocation()

  const segment = pathname.split('/').pop()
  const tab = TABS.find((t) => t.value === segment)?.value ?? 'overview'

  return (
    <Tabs value={tab} className="min-h-0 flex-1 gap-4">
      <TabsList className="w-full shrink-0">
        {TABS.map(({ value, label, to }) => (
          <TabsTrigger key={value} value={value} asChild>
            <Link to={to} params={{ id }}>
              {label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>

      <Outlet />
    </Tabs>
  )
}
