import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { toast } from 'sonner'

import { DatePickerWithRange } from '@/components/date-range-picker'
import { TransactionFab } from '@/components/transaction-fab'
import { TransactionsTable } from '@/components/transaction/transactions-table'
import { Separator } from '@/components/ui/separator'
import {
  type TransactionCreate,
  type TransactionReadWithBalance,
  createTransaction,
  updateTransactions
} from '@/lib/client'
import {
  readAccountOptions,
  readAccountTransactionsWithRunningBalanceOptions,
  readAccountTransactionsWithRunningBalanceQueryKey,
  readAccountsOptions,
  readEventsOptions,
  readEventsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'
import { endExclusive } from '@/lib/utils'

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
      const { data } = editingTransaction
        ? await updateTransactions({
            client,
            body: [{ ...body, id: editingTransaction.id }],
            throwOnError: true
          })
        : await createTransaction({ client, body, throwOnError: true })
      return data
    },
    onSuccess: () => {
      toast.success(`Transaction ${editingTransaction ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })
      queryClient.invalidateQueries({
        queryKey: readAccountTransactionsWithRunningBalanceQueryKey({
          path: { account_id: accountId }
        })
      })
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
  } = useQuery(readAccountOptions({ path: { account_id: accountId } }))

  const { data: accounts } = useQuery(readAccountsOptions())

  // Backs the FAB's event field, so only fetched once the sheet opens.
  const { data: events } = useQuery({
    ...readEventsOptions(),
    enabled: fabOpen
  })

  const {
    isError: isTransactionsError,
    isPending: isTransactionsPending,
    data: transactions,
    error: transactionsError
  } = useQuery(
    readAccountTransactionsWithRunningBalanceOptions({
      path: { account_id: accountId },
      query: { start, end }
    })
  )

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
      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <TransactionsTable
          transactions={transactions}
          currencyCode={account?.currency_code}
          isPending={isTransactionsPending}
          onTransactionEdit={(transaction) => {
            setEditingTransaction(transaction)
            setFabOpen(true)
          }}
        />
      </div>

      <TransactionFab
        accounts={accounts ?? []}
        account={account}
        events={events}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingTransaction={editingTransaction}
        onSubmit={mutate}
        isPending={isPending}
      />
    </>
  )
}
