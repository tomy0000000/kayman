import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { type StatementRead } from '@/lib/client'
import {
  readAccountsOptions,
  readStatementsOptions
} from '@/lib/client/@tanstack/react-query.gen'
import { formatCurrency, formatPlainDate } from '@/lib/utils'

interface StatementRowProps {
  statement: StatementRead
  currencyCode: string
}

export const Route = createFileRoute('/_auth/account/$id/statement')({
  head: () => ({
    meta: [{ title: 'Statement · Kayman' }]
  }),
  component: AccountStatementPage
})

function AccountStatementPage() {
  const { id } = Route.useParams()
  const accountId = Number(id)

  const { isPending: isAccountsPending, data: accounts } = useQuery({
    ...readAccountsOptions(),
    meta: { errorMessage: 'Failed to fetch accounts' }
  })

  const { isPending: isStatementsPending, data: statements } = useQuery({
    ...readStatementsOptions({ query: { account_id: accountId } }),
    meta: { errorMessage: 'Failed to fetch statements' }
  })

  if (isAccountsPending || isStatementsPending) return <StatementsSkeleton />

  const account = accounts?.find((a) => a.id === accountId)
  if (!account) {
    return (
      <p className="text-muted-foreground p-4 text-sm">Account not found.</p>
    )
  }

  // The API orders by period_end_on ascending and exposes no sort parameter.
  const ordered = [...(statements ?? [])].sort((a, b) =>
    b.period_end_on.localeCompare(a.period_end_on)
  )

  if (ordered.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">No statements found.</p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="[&>*:last-child]:border-0">
        {ordered.map((statement) => (
          <StatementRow
            key={statement.id}
            statement={statement}
            currencyCode={account.currency_code}
          />
        ))}
      </div>
    </div>
  )
}

function StatementRow({ statement, currencyCode }: StatementRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3">
      <div className="min-w-0">
        <div className="truncate font-medium">
          {formatPlainDate(statement.period_start_on)} –{' '}
          {formatPlainDate(statement.period_end_on)}
        </div>
        <div className="text-muted-foreground text-sm">
          Due {formatPlainDate(statement.due_on)}
        </div>
      </div>
      <div className="shrink-0 font-medium">
        {formatCurrency(parseFloat(statement.balance), currencyCode)}
      </div>
    </div>
  )
}

function StatementsSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="[&>*:last-child]:border-0">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex items-baseline justify-between gap-4 border-b py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-4 w-28 max-w-full" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
