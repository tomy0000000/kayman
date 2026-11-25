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
import { TransactionSheet } from '@/components/transaction/transaction-sheet'
import { TransactionsTable } from '@/components/transaction/transactions-table'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toast'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { useEventActions } from '@/hooks/use-event-actions'
import {
  type BillTransactionsData,
  type ClearTransactionsData,
  type Options,
  type PostTransactionsData,
  type TransactionEventLinkDetailedRead,
  type TransactionReadWithBalance,
  createEvent,
  createTransaction,
  createTransactionEventLinks,
  deleteTransactionEventLinks,
  updateTransactionEventLinks,
  updateTransactions
} from '@/lib/client'
import {
  billTransactionsMutation,
  clearTransactionsMutation,
  postTransactionsMutation,
  readAccountTransactionsWithRunningBalanceOptions,
  readAccountTransactionsWithRunningBalanceQueryKey,
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsOptions,
  readEventsQueryKey,
  readStatementsOptions,
  readTransactionTagsOptions,
  readTransactionsClearableOptions
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { syncEventEntries } from '@/lib/event-entries'
import {
  predictEvent,
  predictTransactionLinks,
  syncEventTransactions
} from '@/lib/events'
import {
  PLACEHOLDER_ID,
  cacheUpdate,
  useOptimisticMutation
} from '@/lib/optimistic'
import { type EventSubmit, type TransactionSubmit } from '@/lib/types'
import {
  addDecimals,
  formatCalendarDate,
  sameDecimal,
  zonedCalendarDate,
  zonedDayRange
} from '@/lib/utils'

interface TransactionSave extends TransactionSubmit {
  id?: number
  // The links the row had before this submit, so dropped ones can be deleted
  previousLinks: TransactionEventLinkDetailedRead[]
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
  // The id outlives `open` so the sheet keeps its body while closing.
  const [viewing, setViewing] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null
  })

  // The rows only carry their event's id, so the receipt is fetched by the hook.
  const { categoryNames, openEventView, sheetProps } = useEventActions(client, {
    rowsQueryKey: readAccountTransactionsWithRunningBalanceQueryKey({
      path: { account_id: accountId }
    })
  })

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
  const accountNames = new Map(
    (accounts ?? []).map(({ id, name }) => [id, name])
  )

  // The exact list this page shows, so predictions land in the right variant.
  const transactionsOptions = readAccountTransactionsWithRunningBalanceOptions({
    path: { account_id: accountId },
    query: { start, end }
  })

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
      mutationFn: async ({
        body,
        links,
        id,
        previousLinks
      }: TransactionSave) => {
        const created = links.filter((link) => link.id == null)
        // Checked before any write, so a missing position can't leave a half save
        if (created.some(({ index }) => index == null))
          throw new Error('A new event link has no position')
        const createLinks = (transactionId: number) =>
          createTransactionEventLinks({
            client,
            body: created.map(({ event_id, amount, index }) => ({
              transaction_id: transactionId,
              event_id,
              amount,
              index: index as number
            })),
            throwOnError: true
          })

        const kept = new Map(
          links.flatMap((link) => (link.id != null ? [[link.id, link]] : []))
        )
        const removed = previousLinks.filter(({ id }) => !kept.has(id))
        if (removed.length > 0)
          await deleteTransactionEventLinks({
            client,
            query: { ids: removed.map(({ id }) => id) },
            throwOnError: true
          })
        const reshared = previousLinks.flatMap((link) => {
          const next = kept.get(link.id)
          return next && !sameDecimal(next.amount, link.amount)
            ? [{ id: link.id, amount: next.amount }]
            : []
        })
        if (reshared.length > 0)
          await updateTransactionEventLinks({
            client,
            body: reshared,
            throwOnError: true
          })

        if (id == null) {
          const { data } = await createTransaction({
            client,
            body,
            throwOnError: true
          })
          if (created.length > 0) await createLinks(data.id)
          return
        }
        // Every link is in place first, so the amount follow never fires on a split
        if (created.length > 0) await createLinks(id)
        await updateTransactions({
          client,
          body: [{ ...body, id }],
          throwOnError: true
        })
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
        (transactions, { body, links, id, previousLinks }) => {
          const amount = String(body.amount)
          if (id != null)
            return transactions.map((transaction) =>
              transaction.id === id
                ? {
                    ...transaction,
                    ...body,
                    amount,
                    event_links: predictTransactionLinks(
                      links,
                      id,
                      previousLinks,
                      events
                    )
                  }
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
            event_links: predictTransactionLinks(
              links,
              PLACEHOLDER_ID,
              [],
              events
            ),
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

  const saveTransaction = (submit: TransactionSubmit) => {
    setFabOpen(false)
    mutate({
      ...submit,
      id: editingTransaction?.id,
      previousLinks: editingTransaction?.event_links ?? []
    })
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

  // Fired from the details sheet once its dry run finds nothing blocking.
  const { mutate: clearTransactions, isPending: isClearing } =
    useOptimisticMutation(
      {
        ...clearTransactionsMutation(),
        onSuccess: () =>
          toast.add({ title: 'Transaction cleared', type: 'success' }),
        meta: { errorMessage: 'Failed to clear transaction' }
      },
      [
        patchTransactions<Options<ClearTransactionsData>>((clear) => ({
          cleared_at: clear.cleared_at,
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
            previousEvent: null,
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
          (rows, { body, transactions, entries }) => {
            const linked = new Map(transactions.map((leg) => [leg.id, leg]))
            const event = predictEvent(
              body,
              transactions,
              entries,
              accounts ?? []
            )
            return rows.map((row) => {
              const leg = linked.get(row.id)
              if (!leg) return row
              const link = {
                id: PLACEHOLDER_ID,
                transaction_id: row.id,
                event_id: PLACEHOLDER_ID,
                amount: leg.amount,
                index: leg.index,
                event
              }
              return { ...row, event_links: [...row.event_links, link] }
            })
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
    ...readEventsOptions({ query: { cleared_at: 'empty' } }),
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

  // Read from the list so the sheet follows optimistic updates to its row.
  const viewingTransaction =
    transactions?.find((transaction) => transaction.id === viewing.id) ?? null

  const { data: clearable, isLoading: isClearableLoading } = useQuery({
    ...readTransactionsClearableOptions({
      query: { ids: viewingTransaction ? [viewingTransaction.id] : [] }
    }),
    enabled:
      viewing.open && !!viewingTransaction && !viewingTransaction.cleared_at
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

      <div className="flex min-h-0 w-full flex-1 flex-col pb-24">
        <TransactionsTable
          transactions={transactions}
          currencyCode={account?.currency_code}
          categoryNames={categoryNames}
          accountNames={accountNames}
          isPending={isTransactionsPending}
          onTransactionView={(transaction) =>
            setViewing({ open: true, id: transaction.id })
          }
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
          onTransactionCreateEvent={setCreatingEventTransaction}
          onTransactionViewEvent={(event) => openEventView(event.id)}
          onTransactionGoToEvent={(event) => {
            // The day view buckets events by the client timezone, so name the
            // day the event falls on there rather than in the browser zone.
            const day = zonedCalendarDate(new Date(event.timestamp), timezone)
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

      <TransactionSheet
        open={viewing.open}
        onOpenChange={(open) => setViewing((current) => ({ ...current, open }))}
        transaction={viewingTransaction}
        clearErrors={
          viewingTransaction
            ? (clearable?.[viewingTransaction.id]?.errors ?? [])
            : []
        }
        isClearableLoading={isClearableLoading}
        isClearPending={isClearing}
        onClear={() => {
          if (!viewingTransaction) return
          setViewing((current) => ({ ...current, open: false }))
          clearTransactions({
            body: [
              {
                transaction_id: viewingTransaction.id,
                cleared_at: new Date().toISOString()
              }
            ]
          })
        }}
        account={account}
        categoryNames={categoryNames}
        accountNames={accountNames}
      />

      <EventSheet {...sheetProps} />
    </>
  )
}
