import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { CreateStatementFab } from '@/components/statement/create-statement-fab'
import { StatementBillDialog } from '@/components/statement/statement-bill-dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import {
  type AccountType,
  type BillTransactionsData,
  type CreateStatementData,
  type Options,
  type StatementRead,
  type TransactionRead
} from '@/lib/client'
import {
  billTransactionsMutation,
  createStatementMutation,
  readAccountTransactionsWithRunningBalanceQueryKey,
  readAccountsOptions,
  readCurrenciesOptions,
  readEventsQueryKey,
  readStatementsOptions,
  readStatementsQueryKey,
  readTransactionsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import {
  PLACEHOLDER_ID,
  cacheUpdate,
  useOptimisticMutation
} from '@/lib/optimistic'
import { issuerBalance, previousStatement } from '@/lib/statements'
import {
  cn,
  formatCalendarDate,
  formatCurrency,
  formatPlainDate
} from '@/lib/utils'

interface StatementRowProps {
  statement: StatementRead
  accountType: AccountType
  currencyCode: string
  onBill: (statement: StatementRead) => void
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

  const [fabOpen, setFabOpen] = useState(false)
  const [billingStatement, setBillingStatement] =
    useState<StatementRead | null>(null)

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

  const { mutate, isPending: isCreating } = useOptimisticMutation(
    {
      ...createStatementMutation(),
      onSuccess: (statement) => {
        toast.add({ title: 'Statement created', type: 'success' })
        // Billing needs the real id, so it waits for the server's statement.
        setBillingStatement(statement)
      },
      meta: { errorMessage: 'Failed to create statement' }
    },
    [
      cacheUpdate<StatementRead[], Options<CreateStatementData>>(
        readStatementsQueryKey({ query: { account_id: accountId } }),
        (statements, { body }) => [
          ...statements,
          {
            ...body,
            id: PLACEHOLDER_ID,
            balance: String(body.balance),
            created_on: body.created_on ?? formatCalendarDate(new Date())
          }
        ]
      )
    ]
  )

  const { mutate: billTransactions } = useOptimisticMutation(
    {
      ...billTransactionsMutation(),
      onSuccess: () =>
        toast.add({ title: 'Transactions billed', type: 'success' }),
      meta: { errorMessage: 'Failed to bill transactions' }
    },
    [
      cacheUpdate<TransactionRead[], Options<BillTransactionsData>>(
        readTransactionsQueryKey(),
        (transactions, { body }) => {
          const billed = new Map(
            body.map((bill) => [bill.transaction_id, bill.statement_id])
          )
          return transactions.map((transaction) =>
            billed.has(transaction.id)
              ? {
                  ...transaction,
                  statement_id: billed.get(transaction.id),
                  status: 'BILLED'
                }
              : transaction
          )
        }
      ),
      {
        queryKey: readAccountTransactionsWithRunningBalanceQueryKey({
          path: { account_id: accountId }
        })
      },
      { queryKey: readEventsQueryKey() }
    ]
  )

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
                accountType={account.type}
                currencyCode={account.currency_code}
                onBill={setBillingStatement}
              />
            ))}
          </div>
        )}
      </div>

      <CreateStatementFab
        accountId={accountId}
        accountType={account.type}
        currency={currencies?.find((c) => c.code === account.currency_code)}
        statements={ordered}
        open={fabOpen}
        onOpenChange={setFabOpen}
        onSubmit={(body) => {
          setFabOpen(false)
          mutate({ body })
        }}
        isPending={isCreating}
      />

      <StatementBillDialog
        statement={billingStatement}
        previousStatement={
          billingStatement
            ? previousStatement(ordered, billingStatement)
            : undefined
        }
        account={account}
        open={billingStatement != null}
        onOpenChange={(open) => {
          if (!open) setBillingStatement(null)
        }}
        onSubmit={(body) => {
          setBillingStatement(null)
          billTransactions({ body })
        }}
      />
    </>
  )
}

function StatementRow({
  statement,
  accountType,
  currencyCode,
  onBill
}: StatementRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'flex items-baseline justify-between gap-4 border-b py-3',
            statement.id < 0 && 'pointer-events-none opacity-50'
          )}
        >
          <div className="min-w-0">
            <div className="truncate font-medium">
              {formatPlainDate(statement.period_start_on)} –{' '}
              {formatPlainDate(statement.period_end_on)}
            </div>
            <div className="text-muted-foreground text-sm">
              {statement.due_on
                ? `Due ${formatPlainDate(statement.due_on)}`
                : 'No due date'}
            </div>
          </div>
          <div className="shrink-0 font-medium">
            {formatCurrency(
              parseFloat(issuerBalance(statement.balance, accountType)),
              currencyCode
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={(event) => event.preventDefault()}>
        <ContextMenuItem onSelect={() => onBill(statement)}>
          Bill transactions…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
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
