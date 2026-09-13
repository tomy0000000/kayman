import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { CreateStatementFab } from '@/components/statement/create-statement-fab'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { type StatementRead } from '@/lib/client'
import {
  createStatementMutation,
  readAccountsOptions,
  readCurrenciesOptions,
  readStatementsOptions,
  readStatementsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
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
  const queryClient = useQueryClient()

  const [fabOpen, setFabOpen] = useState(false)

  const { isPending: isAccountsPending, data: accounts } = useQuery({
    ...readAccountsOptions(),
    meta: { errorMessage: 'Failed to fetch accounts' }
  })

  const { isPending: isStatementsPending, data: statements } = useQuery({
    ...readStatementsOptions({ query: { account_id: accountId } }),
    meta: { errorMessage: 'Failed to fetch statements' }
  })

  // Backs the form's balance field, so only fetched once the sheet opens.
  const { data: currencies } = useQuery({
    ...readCurrenciesOptions(),
    enabled: fabOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  const { mutate, isPending: isCreating } = useMutation({
    ...createStatementMutation(),
    onSuccess: () => {
      toast.add({ title: 'Statement created', type: 'success' })
      queryClient.invalidateQueries({ queryKey: readStatementsQueryKey() })
      setFabOpen(false)
    },
    meta: { errorMessage: 'Failed to create statement' }
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

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ordered.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            No statements found.
          </p>
        ) : (
          <div className="[&>*:last-child]:border-0">
            {ordered.map((statement) => (
              <StatementRow
                key={statement.id}
                statement={statement}
                currencyCode={account.currency_code}
              />
            ))}
          </div>
        )}
      </div>

      <CreateStatementFab
        accountId={accountId}
        currency={currencies?.find((c) => c.code === account.currency_code)}
        statements={ordered}
        open={fabOpen}
        onOpenChange={setFabOpen}
        onSubmit={(body) => mutate({ body })}
        isPending={isCreating}
      />
    </>
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
