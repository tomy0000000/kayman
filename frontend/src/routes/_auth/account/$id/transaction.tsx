import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useEffect, useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { toast } from 'sonner'

import { Amount } from '@/components/amount'
import { DatePickerWithRange } from '@/components/date-range-picker'
import { TransactionFab } from '@/components/transaction-fab'
import { TransactionStatusBadge } from '@/components/transaction-status-badge'
import { Separator } from '@/components/ui/separator'
import {
  type TransactionCreate,
  type TransactionReadWithBalance,
  createTransaction,
  readAccount,
  readAccountTransactionsWithRunningBalance,
  readAccounts,
  updateTransactions
} from '@/lib/client'
import { cn, endExclusive, formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/_auth/account/$id/transaction')({
  component: AccountTransactionPage
})

function AccountTransactionPage() {
  const { client } = Route.useRouteContext()
  const { id } = Route.useParams()
  const accountId = Number(id)
  const queryClient = useQueryClient()

  const [fabOpen, setFabOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionReadWithBalance | null>(null)

  const handleFabOpenChange = (open: boolean) => {
    setFabOpen(open)
    if (open) setEditingTransaction(null)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: TransactionCreate) => {
      const response = editingTransaction
        ? await updateTransactions({
            client,
            body: [{ ...body, id: editingTransaction.id }]
          })
        : await createTransaction({ client, body })
      if (response.error)
        throw new Error(
          `Failed to ${editingTransaction ? 'update' : 'create'} transaction`
        )
      if (!response.data) throw new Error('No data returned')
      return response.data
    },
    onSuccess: () => {
      toast.success(`Transaction ${editingTransaction ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setFabOpen(false)
    },
    onError: (error) => {
      console.error(error)
      toast.error(
        `Failed to ${editingTransaction ? 'update' : 'create'} transaction`,
        {
          description:
            error instanceof Error ? error.message : 'An unknown error occurred'
        }
      )
    }
  })

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const start = dateRange?.from?.toISOString() ?? null
  const end = endExclusive(dateRange?.to)

  const {
    isError,
    data: account,
    error
  } = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const response = await readAccount({
        client,
        path: { account_id: accountId }
      })
      if (response.error) throw new Error('Failed to fetch account')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await readAccounts({ client })
      if (response.error) throw new Error('Failed to fetch accounts')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  const {
    isError: isTransactionsError,
    data: transactions,
    error: transactionsError
  } = useQuery({
    queryKey: ['transactions', { accountId, start, end }],
    queryFn: async () => {
      const response = await readAccountTransactionsWithRunningBalance({
        client,
        path: { account_id: accountId },
        query: { start, end }
      })
      if (response.error) throw new Error('Failed to fetch transactions')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  useEffect(() => {
    if (!isError) return
    console.error(error)
    toast.error('Failed to fetch account', {
      description:
        error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }, [isError, error])

  useEffect(() => {
    if (!isTransactionsError) return
    console.error(transactionsError)
    toast.error('Failed to fetch transactions', {
      description:
        transactionsError instanceof Error
          ? transactionsError.message
          : 'An unknown error occurred'
    })
  }, [isTransactionsError, transactionsError])

  return (
    <>
      {/* Date Picker */}
      <div className="bg-background sticky top-0 z-10 pt-4">
        <div className="flex items-end justify-center gap-3 overflow-x-auto">
          <DatePickerWithRange
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
        </div>

        <Separator className="my-4 bg-foreground/30" />
      </div>

      {/* Transactions */}
      <div className="min-h-0 w-full flex-1 snap-y snap-mandatory overflow-y-auto scroll-pt-7 sm:scroll-pt-0">
        {transactions?.map(function (transaction, index) {
          const timestamp = new Date(transaction.created_at)
          const amount = parseFloat(transaction.amount)
          const dateLabel = timestamp.toLocaleDateString()
          const prevDateLabel =
            index > 0
              ? new Date(
                  transactions[index - 1].created_at
                ).toLocaleDateString()
              : null
          const showDate = dateLabel !== prevDateLabel

          return (
            <Fragment key={transaction.id}>
              {/* Separator: full width on date change, indented only on >=sm */}
              {index > 0 && (
                <Separator
                  className={cn(
                    'my-2 snap-start',
                    !showDate && 'sm:ml-[calc(--spacing(24)+(--spacing(3)))]'
                  )}
                />
              )}

              {/* Narrow-viewport sticky date header */}
              {showDate && (
                <>
                  <div className="bg-background sticky top-0 z-5 py-1 text-sm font-semibold sm:hidden">
                    {dateLabel}
                  </div>
                  <Separator className="my-2 sm:hidden" />
                </>
              )}

              {/* Row — first row gets snap-start too so scrollTop=0 is a valid snap point */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditingTransaction(transaction)
                  setFabOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setEditingTransaction(transaction)
                    setFabOpen(true)
                  }
                }}
                className={cn(
                  'hover:bg-muted focus-visible:ring-ring flex cursor-pointer items-start gap-3 rounded-md py-1 text-sm focus-visible:ring-2 focus-visible:outline-none',
                  index === 0 && 'snap-start'
                )}
              >
                {/* Date — only on >=sm */}
                <div className="hidden w-24 shrink-0 text-neutral-500 sm:block">
                  {showDate ? dateLabel : ''}
                </div>

                {/* Time */}
                <div className="w-24 shrink-0 text-neutral-500">
                  {timestamp.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>

                {/* Description — only thing allowed to shrink/truncate */}
                <div className="min-w-0 flex-1 truncate font-semibold">
                  {transaction.description}
                </div>

                {/* Status */}
                <TransactionStatusBadge status={transaction.status} />

                {/* Amount + running balance */}
                <div className="flex w-24 shrink-0 flex-col items-end">
                  <Amount
                    amount={amount}
                    currencyCode={account?.currency_code}
                  />
                  <span className="text-muted-foreground text-xs">
                    {account
                      ? formatCurrency(
                          parseFloat(transaction.running_balance),
                          account.currency_code
                        )
                      : transaction.running_balance}
                  </span>
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      <TransactionFab
        accounts={accounts ?? []}
        account={account}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingTransaction={editingTransaction}
        onSubmit={mutate}
        isPending={isPending}
      />
    </>
  )
}
