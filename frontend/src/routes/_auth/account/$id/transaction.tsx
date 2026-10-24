import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { type DateRange } from 'react-day-picker'

import { DatePickerWithRange } from '@/components/date-range-picker'
import { CreateEventSheet } from '@/components/event/create-event-sheet'
import { EventSheet } from '@/components/event/event-sheet'
import { TransactionBillSheet } from '@/components/transaction/transaction-bill-sheet'
import { TransactionFab } from '@/components/transaction/transaction-fab'
import { TransactionPostSheet } from '@/components/transaction/transaction-post-sheet'
import { TransactionsTable } from '@/components/transaction/transactions-table'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toast'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { useEventActions } from '@/hooks/use-event-actions'
import {
  type BillTransactionsData,
  type ClearTransactionData,
  type Options,
  type PostTransactionsData,
  type TransactionCreate,
  type TransactionReadWithBalance,
  createEvent,
  createTransaction,
  updateTransactions
} from '@/lib/client'
import {
  billTransactionsMutation,
  clearTransactionMutation,
  postTransactionsMutation,
  readAccountTransactionsWithRunningBalanceOptions,
  readAccountTransactionsWithRunningBalanceQueryKey,
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsOptions,
  readEventsQueryKey,
  readStatementsOptions,
  readTransactionTagsOptions
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { syncEventEntries } from '@/lib/event-entries'
import { syncEventTransactions } from '@/lib/events'
import {
  PLACEHOLDER_ID,
  cacheUpdate,
  useOptimisticMutation
} from '@/lib/optimistic'
import { type EventSubmit } from '@/lib/types'
import {
  addDecimals,
  formatCalendarDate,
  zonedCalendarDate,
  zonedDayRange
} from '@/lib/utils'

interface TransactionSave {
  body: TransactionCreate
  id?: number
}

export const Route = createFileRoute('/_auth/account/$id/transaction')({
  head: () => ({
    meta: [{ title: 'Transaction · Kayman' }]
  }),
  component: AccountTransactionPage
})

function AccountTransactionPage() {
  const { client } = Route.useRouteContext()
  const { id } = Route.useParams()
  const accountId = Number(id)
  const navigate = useNavigate()
  const { timezone } = useClientTimezone()

  const [fabOpen, setFabOpen] = useState(false)
  const [sheetTransaction, setSheetTransaction] = useState<{
    mode: 'edit' | 'duplicate'
    transaction: TransactionReadWithBalance
  } | null>(null)
  const [postingTransaction, setPostingTransaction] =
    useState<TransactionReadWithBalance | null>(null)
  const [billingTransaction, setBillingTransaction] =
    useState<TransactionReadWithBalance | null>(null)
  const [creatingEventTransaction, setCreatingEventTransaction] =
    useState<TransactionReadWithBalance | null>(null)

  // The rows only carry their event's id, so the receipt is fetched by the hook.
  const { openEventView, sheetProps } = useEventActions(client)

  const editingTransaction =
    sheetTransaction?.mode === 'edit' ? sheetTransaction.transaction : null
  const seedTransaction =
    sheetTransaction?.mode === 'duplicate' ? sheetTransaction.transaction : null

  const handleFabOpenChange = (open: boolean) => {
    setFabOpen(open)
    if (open) setSheetTransaction(null)
  }

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const start = dateRange?.from
    ? zonedDayRange(dateRange.from, timezone).start
    : null
  const end = dateRange?.to ? zonedDayRange(dateRange.to, timezone).end : null

  const { data: accounts } = useQuery({
    ...readAccountsOptions(),
    meta: { errorMessage: 'Failed to fetch accounts' }
  })

  // The page's account is just a row of the list the FAB already needs.
  const account = accounts?.find((a) => a.id === accountId)

  // The exact list this page shows, so predictions land in the right variant.
  const transactionsOptions = readAccountTransactionsWithRunningBalanceOptions({
    path: { account_id: accountId },
    query: { start, end }
  })

  const patchTransaction = <
    TVariables extends { path: { transaction_id: number } }
  >(
    patch: (variables: TVariables) => Partial<TransactionReadWithBalance>
  ) =>
    cacheUpdate<TransactionReadWithBalance[], TVariables>(
      transactionsOptions.queryKey,
      (transactions, variables) =>
        transactions.map((transaction) =>
          transaction.id === variables.path.transaction_id
            ? { ...transaction, ...patch(variables) }
            : transaction
        )
    )

  const patchTransactions = <
    TVariables extends { body: Array<{ transaction_id: number }> }
  >(
    patch: (
      item: TVariables['body'][number]
    ) => Partial<TransactionReadWithBalance>
  ) =>
    cacheUpdate<TransactionReadWithBalance[], TVariables>(
      transactionsOptions.queryKey,
      (transactions, { body }) => {
        const items = new Map(body.map((item) => [item.transaction_id, item]))
        return transactions.map((transaction) => {
          const item = items.get(transaction.id)
          return item ? { ...transaction, ...patch(item) } : transaction
        })
      }
    )

  // One mutation for the FAB's create and edit; `id` rides in the variables so
  // the cache update can tell them apart. A created row is inserted by instant
  // with the running balance it would have; the rows after it keep their old
  // balance until the refetch. An edit patches its row in place.
  const { mutate, isPending } = useOptimisticMutation(
    {
      mutationFn: async ({ body, id }: TransactionSave) => {
        const { data } =
          id != null
            ? await updateTransactions({
                client,
                body: [{ ...body, id }],
                throwOnError: true
              })
            : await createTransaction({ client, body, throwOnError: true })
        return data
      },
      onSuccess: (_data, { id }) =>
        toast.add({
          title: `Transaction ${id != null ? 'updated' : 'created'}`,
          type: 'success'
        }),
      meta: {
        errorMessage: `Failed to ${editingTransaction ? 'update' : 'create'} transaction`
      }
    },
    [
      cacheUpdate<TransactionReadWithBalance[], TransactionSave>(
        transactionsOptions.queryKey,
        (transactions, { body, id }) => {
          const amount = String(body.amount)
          if (id != null)
            return transactions.map((transaction) =>
              transaction.id === id
                ? { ...transaction, ...body, amount }
                : transaction
            )
          const created_at = body.created_at ?? new Date().toISOString()
          const instant = Date.parse(created_at)
          let at = transactions.findIndex(
            (transaction) => Date.parse(transaction.created_at) > instant
          )
          if (at === -1) at = transactions.length
          const previous = transactions[at - 1]?.running_balance ?? '0'
          const placeholder: TransactionReadWithBalance = {
            ...body,
            id: PLACEHOLDER_ID,
            amount,
            created_at,
            currency_code: account?.currency_code ?? '',
            event: null,
            tags: [],
            running_balance: addDecimals(previous, amount),
            status: 'PENDING'
          }
          return [
            ...transactions.slice(0, at),
            placeholder,
            ...transactions.slice(at)
          ]
        }
      ),
      { queryKey: readEventsQueryKey() }
    ]
  )

  const saveTransaction = (body: TransactionCreate) => {
    setFabOpen(false)
    mutate({ body, id: editingTransaction?.id })
  }

  const { mutate: postTransactions, isPending: isPosting } =
    useOptimisticMutation(
      {
        ...postTransactionsMutation(),
        onSuccess: () =>
          toast.add({ title: 'Transaction posted', type: 'success' }),
        meta: { errorMessage: 'Failed to post transaction' }
      },
      [
        patchTransactions<Options<PostTransactionsData>>((post) => ({
          posted_at: post.posted_at,
          status: 'POSTED',
          ...(post.amount != null && { amount: String(post.amount) })
        })),
        { queryKey: readEventsQueryKey() }
      ]
    )

  const { mutate: billTransactions, isPending: isBilling } =
    useOptimisticMutation(
      {
        ...billTransactionsMutation(),
        onSuccess: () =>
          toast.add({ title: 'Transaction billed', type: 'success' }),
        meta: { errorMessage: 'Failed to bill transaction' }
      },
      [
        patchTransactions<Options<BillTransactionsData>>((bill) => ({
          statement_id: bill.statement_id,
          status: 'BILLED',
          ...(bill.amount != null && { amount: String(bill.amount) })
        })),
        { queryKey: readEventsQueryKey() }
      ]
    )

  // Clearing takes no input beyond the moment it happened, so it fires
  // straight from the context menu like clearing an event does.
  const { mutate: clearTransaction } = useOptimisticMutation(
    {
      ...clearTransactionMutation(),
      onSuccess: () =>
        toast.add({ title: 'Transaction cleared', type: 'success' }),
      meta: { errorMessage: 'Failed to clear transaction' }
    },
    [
      patchTransaction<Options<ClearTransactionData>>(({ body }) => ({
        cleared_at: body.cleared_at,
        status: 'CLEARED'
      })),
      { queryKey: readEventsQueryKey() }
    ]
  )

  const { mutate: createEventFromTransaction, isPending: isCreatingEvent } =
    useOptimisticMutation(
      {
        mutationFn: async ({ body, transactions, entries }: EventSubmit) => {
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
        onSuccess: () => toast.add({ title: 'Event created', type: 'success' }),
        meta: { errorMessage: 'Failed to create event' }
      },
      [
        cacheUpdate<TransactionReadWithBalance[], EventSubmit>(
          transactionsOptions.queryKey,
          (rows, { body, transactions }) => {
            const linked = new Set(transactions.map(({ id }) => id))
            const event = { ...body, id: PLACEHOLDER_ID, cleared_at: null }
            return rows.map((row) =>
              linked.has(row.id)
                ? { ...row, event_id: PLACEHOLDER_ID, event }
                : row
            )
          }
        ),
        { queryKey: readEventsQueryKey() },
        {
          queryKey: readAccountTransactionsWithRunningBalanceQueryKey({
            path: { account_id: accountId }
          })
        }
      ]
    )

  // Backs the FAB's event field, so only fetched once the sheet opens.
  const { data: events } = useQuery({
    ...readEventsOptions(),
    enabled: fabOpen
  })

  // Back the create-event sheet's entry fields, fetched once it opens.
  const { data: categories } = useQuery({
    ...readCategoriesOptions(),
    enabled: creatingEventTransaction != null,
    staleTime: REFERENCE_STALE_TIME
  })

  // Backs the bill sheet's statement picker, fetched once it opens.
  const { data: statements } = useQuery({
    ...readStatementsOptions({ query: { account_id: accountId } }),
    enabled: billingTransaction != null,
    meta: { errorMessage: 'Failed to fetch statements' }
  })

  const { data: currencies } = useQuery({
    ...readCurrenciesOptions(),
    staleTime: REFERENCE_STALE_TIME
  })

  // Backs the FAB's and the create-event sheet's tag pickers, fetched once
  // either opens.
  const { data: transactionTags } = useQuery({
    ...readTransactionTagsOptions(),
    enabled: fabOpen || creatingEventTransaction != null,
    staleTime: REFERENCE_STALE_TIME
  })

  const { isPending: isTransactionsPending, data: transactions } = useQuery({
    ...transactionsOptions,
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

      <div className="min-h-0 w-full flex-1 overflow-y-auto pb-24">
        <TransactionsTable
          transactions={transactions}
          currencyCode={account?.currency_code}
          isPending={isTransactionsPending}
          onTransactionEdit={(transaction) => {
            setSheetTransaction({ mode: 'edit', transaction })
            setFabOpen(true)
          }}
          onTransactionDuplicate={(transaction) => {
            setSheetTransaction({ mode: 'duplicate', transaction })
            setFabOpen(true)
          }}
          onTransactionPost={setPostingTransaction}
          onTransactionBill={setBillingTransaction}
          onTransactionClear={(transaction) =>
            clearTransaction({
              path: { transaction_id: transaction.id },
              body: { cleared_at: new Date().toISOString() }
            })
          }
          onTransactionCreateEvent={setCreatingEventTransaction}
          onTransactionViewEvent={(transaction) => {
            if (!transaction.event) return
            openEventView(transaction.event.id)
          }}
          onTransactionGoToEvent={(transaction) => {
            if (!transaction.event) return
            // The day view buckets events by the client timezone, so name the
            // day the event falls on there rather than in the browser zone.
            const day = zonedCalendarDate(
              new Date(transaction.event.timestamp),
              timezone
            )
            navigate({
              to: '/',
              search: { date: formatCalendarDate(day) }
            })
          }}
        />
      </div>

      <TransactionFab
        accounts={accounts ?? []}
        account={account}
        currencies={currencies ?? []}
        transactionTags={transactionTags ?? []}
        events={events}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingTransaction={editingTransaction}
        seedTransaction={seedTransaction}
        onSubmit={saveTransaction}
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
          setPostingTransaction(null)
          postTransactions({
            body: [{ ...body, transaction_id: postingTransaction.id }]
          })
        }}
        isPending={isPosting}
      />

      <TransactionBillSheet
        transaction={billingTransaction}
        account={account}
        currency={currencies?.find(
          (c) => c.code === billingTransaction?.currency_code
        )}
        statements={statements ?? []}
        open={billingTransaction != null}
        onOpenChange={(open) => {
          if (!open) setBillingTransaction(null)
        }}
        onSubmit={(body) => {
          if (billingTransaction == null) return
          setBillingTransaction(null)
          billTransactions({
            body: [{ ...body, transaction_id: billingTransaction.id }]
          })
        }}
        isPending={isBilling}
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
        onSubmit={(body, transactions, entries) => {
          setCreatingEventTransaction(null)
          createEventFromTransaction({ body, transactions, entries })
        }}
        isPending={isCreatingEvent}
      />

      <EventSheet {...sheetProps} />
    </>
  )
}
