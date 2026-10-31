import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import {
  AccountCard,
  AccountCardSkeleton
} from '@/components/account/account-card'
import { readAccountsOptions } from '@/lib/client/@tanstack/react-query.gen'

export const Route = createFileRoute('/_auth/account/$id/')({
  head: () => ({
    meta: [{ title: 'Overview · Kayman' }]
  }),
  component: AccountOverviewPage
})

function AccountOverviewPage() {
  const { id } = Route.useParams()
  const accountId = Number(id)

  const { isPending, data: accounts } = useQuery({
    ...readAccountsOptions(),
    meta: { errorMessage: 'Failed to fetch accounts' }
  })

  if (isPending) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccountCardSkeleton className="max-w-md" />
      </div>
    )
  }

  const account = accounts?.find((a) => a.id === accountId)
  if (!account) {
    return (
      <p className="text-muted-foreground p-4 text-sm">Account not found.</p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AccountCard account={account} className="max-w-md" />
    </div>
  )
}
