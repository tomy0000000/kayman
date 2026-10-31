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
import type { AccountRead } from '@/lib/client'
import { cn, formatCurrency, formatDate, gmtLabel } from '@/lib/utils'

interface AccountCardProps extends React.ComponentProps<typeof Card> {
  account: AccountRead
}

interface InfoRowProps {
  label: string
  children: React.ReactNode
}

function AccountCard({ account, ...props }: AccountCardProps) {
  const { timezone } = useClientTimezone()

  const type = ACCOUNT_TYPES.find((t) => t.value === account.type)
  const balance = parseFloat(account.balance)
  const isNegative = balance < 0

  return (
    <Card {...props}>
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

function AccountCardSkeleton(props: React.ComponentProps<typeof Card>) {
  return (
    <Card {...props}>
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
  )
}

export { AccountCard, AccountCardSkeleton }
