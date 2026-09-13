import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { ACCOUNT_TYPES } from '@/lib/account-types'
import { readAccountsOptions } from '@/lib/client/@tanstack/react-query.gen'
import { cn, formatCurrency, formatDate, gmtLabel } from '@/lib/utils'

interface InfoRowProps {
  label: string
  children: React.ReactNode
}

export const Route = createFileRoute('/_auth/account/$id/')({
  head: () => ({
    meta: [{ title: 'Overview · Kayman' }]
  }),
  component: AccountOverviewPage
})

function AccountOverviewPage() {
  const { id } = Route.useParams()
  const accountId = Number(id)
  const { timezone } = useClientTimezone()

  const { isPending, data: accounts } = useQuery({
    ...readAccountsOptions(),
    meta: { errorMessage: 'Failed to fetch accounts' }
  })

  if (isPending) return <OverviewSkeleton />

  const account = accounts?.find((a) => a.id === accountId)
  if (!account) {
    return (
      <p className="text-muted-foreground p-4 text-sm">Account not found.</p>
    )
  }

  const type = ACCOUNT_TYPES.find((t) => t.value === account.type)
  const balance = parseFloat(account.balance)
  const isNegative = balance < 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="truncate">{account.name}</CardTitle>
          {type && (
            <CardAction>
              <Badge variant="outline">
                <type.icon />
                {type.label}
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            className={cn(
              'text-2xl font-semibold',
              isNegative ? 'text-red-500' : 'text-green-500'
            )}
          >
            {isNegative
              ? `(${formatCurrency(Math.abs(balance), account.currency_code)})`
              : formatCurrency(balance, account.currency_code)}
          </div>

          <dl className="grid gap-2 border-t pt-4">
            <InfoRow label="Currency">{account.currency_code}</InfoRow>
            <InfoRow label="Timezone">
              {account.timezone} ({gmtLabel(account.timezone)})
            </InfoRow>
            <InfoRow label="Created">
              {formatDate(account.created_at, timezone)}
            </InfoRow>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Card className="max-w-md">
        <CardHeader>
          <Skeleton className="h-5 w-40 max-w-full" />
        </CardHeader>

        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-36 max-w-full" />

          <div className="grid gap-2 border-t pt-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
