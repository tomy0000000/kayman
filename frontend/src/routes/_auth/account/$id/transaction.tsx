import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { toast } from 'sonner'

import { DatePickerWithRange } from '@/components/date-range-picker'
import { CreateEventSheet } from '@/components/event/create-event-sheet'
import { TransactionPostSheet } from '@/components/transaction-post-sheet'
import { TransactionFab } from '@/components/transaction/transaction-fab'
import { TransactionsTable } from '@/components/transaction/transactions-table'
import { Separator } from '@/components/ui/separator'
import {
  type EventCreate,
  type TransactionCreate,
  type TransactionReadWithBalance,
  createEvent,
  createTransaction,
  updateTransactions
} from '@/lib/client'
import {
  postTransactionMutation,
  readAccountOptions,
  readAccountTransactionsWithRunningBalanceOptions,
  readAccountTransactionsWithRunningBalanceQueryKey,
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsOptions,
  readEventsQueryKey,
  readTransactionTagsOptions
} from '@/lib/client/@tanstack/react-query.gen'
import { syncEventEntries } from '@/lib/event-entries'
import { syncEventTransactions } from '@/lib/events'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'
import { endExclusive } from '@/lib/utils'

export const Route = createFileRoute('/_auth/account/$id/transaction')({
  component: AccountTransactionPage
})

function AccountTransactionPage() {
  const { client } = Route.useRouteContext()
  const { id } = Route.useParams()
  const accountId = Number(id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [fabOpen, setFabOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionReadWithBalance | null>(null)
  const [postingTransaction, setPostingTransaction] =
    useState<TransactionReadWithBalance | null>(null)
  const [creatingEventTransaction, setCreatingEventTransaction] =
    useState<TransactionReadWithBalance | null>(null)

  const handleFabOpenChange = (open: boolean) => {
    setFabOpen(open)
    if (open) setEditingTransaction(null)
  }

  const invalidateTransactions = () => {
    queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })
    queryClient.invalidateQueries({
      queryKey: readAccountTransactionsWithRunningBalanceQueryKey({
        path: { account_id: accountId }
      })
    })
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
      invalidateTransactions()
      setFabOpen(false)
    },
    meta: {
      errorMessage: `Failed to ${editingTransaction ? 'update' : 'create'} transaction`
    }
  })

  const { mutate: postTransaction, isPending: isPosting } = useMutation({
    ...postTransactionMutation(),
    onSuccess: () => {
      toast.success('Transaction posted')
      invalidateTransactions()
      setPostingTransaction(null)
    },
    meta: { errorMessage: 'Failed to post transaction' }
  })

  const { mutate: createEventFromTransaction, isPending: isCreatingEvent } =
    useMutation({
      mutationFn: async ({
        body,
        transactions,
        entries
      }: {
        body: EventCreate
        transactions: TransactionPayload[]
        entries: EventEntryPayload[]
      }) => {
        const { data: event } = await createEvent({
          client,
          body,
          throwOnError: true
        })

        await syncEventTransactions({
          client,
          eventId: event.id,
          transactions,
          previousTransactions: [],
          createdAt: body.timestamp
        })

        await syncEventEntries({
          client,
          eventId: event.id,
          entries,
          previousEntries: []
        })

        return event
      },
      onSuccess: () => {
        toast.success('Event created')
        setCreatingEventTransaction(null)
      },
      // Settled, not success: the submit spans several calls, so a failure
      // partway can still have created rows the table is not showing yet.
      onSettled: invalidateTransactions,
      meta: { errorMessage: 'Failed to create event' }
    })

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const start = dateRange?.from?.toISOString() ?? null
  const end = endExclusive(dateRange?.to)

  const { data: account } = useQuery({
    ...readAccountOptions({ path: { account_id: accountId } }),
    meta: { errorMessage: 'Failed to fetch account' }
  })

  const { data: accounts } = useQuery(readAccountsOptions())

  // Backs the FAB's event field, so only fetched once the sheet opens.
  const { data: events } = useQuery({
    ...readEventsOptions(),
    enabled: fabOpen
  })

  // Back the create-event sheet's entry fields, fetched once it opens.
  const { data: categories } = useQuery({
    ...readCategoriesOptions(),
    enabled: creatingEventTransaction != null
  })

  const { data: currencies } = useQuery(readCurrenciesOptions())

  // Backs the create-event sheet's tag pickers, fetched once it opens.
  const { data: transactionTags } = useQuery({
    ...readTransactionTagsOptions(),
    enabled: creatingEventTransaction != null
  })

  const { isPending: isTransactionsPending, data: transactions } = useQuery({
    ...readAccountTransactionsWithRunningBalanceOptions({
      path: { account_id: accountId },
      query: { start, end }
    }),
    meta: { errorMessage: 'Failed to fetch transactions' }
  })

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
          onTransactionPost={setPostingTransaction}
          onTransactionCreateEvent={setCreatingEventTransaction}
          onTransactionGoToEvent={(transaction) => {
            if (!transaction.event) return
            navigate({
              to: '/',
              search: {
                date: new Date(transaction.event.timestamp).toLocaleDateString(
                  'en-CA'
                )
              }
            })
          }}
        />
      </div>

      <TransactionFab
        accounts={accounts ?? []}
        account={account}
        currencies={currencies ?? []}
        events={events}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingTransaction={editingTransaction}
        onSubmit={mutate}
        isPending={isPending}
      />

      <TransactionPostSheet
        transaction={postingTransaction}
        account={account}
        currency={currencies?.find(
          (c) => c.code === postingTransaction?.currency_code
        )}
        open={postingTransaction != null}
        onOpenChange={(open) => {
          if (!open) setPostingTransaction(null)
        }}
        onSubmit={(body) => {
          if (postingTransaction == null) return
          postTransaction({
            path: { transaction_id: postingTransaction.id },
            body
          })
        }}
        isPending={isPosting}
      />

      <CreateEventSheet
        transaction={creatingEventTransaction}
        account={account}
        accounts={accounts ?? []}
        categories={categories ?? []}
        currencies={currencies ?? []}
        transactionTags={transactionTags ?? []}
        open={creatingEventTransaction != null}
        onOpenChange={(open) => {
          if (!open) setCreatingEventTransaction(null)
        }}
        onSubmit={(body, transactions, entries) =>
          createEventFromTransaction({ body, transactions, entries })
        }
        isPending={isCreatingEvent}
      />
    </>
  )
}
