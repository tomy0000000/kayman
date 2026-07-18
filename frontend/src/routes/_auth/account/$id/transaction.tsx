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
  type EventCreate,
  type EventEntryCreate,
  type TransactionCreate,
  type TransactionReadWithBalance,
  createEvent,
  createEventEntries,
  createTransaction,
  readAccount,
  readAccountTransactionsWithRunningBalance,
  readAccounts,
  readCategories,
  readCurrencies,
  readEvents,
  updateTransactions
} from '@/lib/client'
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

  const createEventMutation = useMutation({
    mutationFn: async ({
      body,
      linkedTransactionIds,
      entries
    }: {
      body: EventCreate
      linkedTransactionIds: number[]
      entries: Omit<EventEntryCreate, 'event_id'>[]
    }) => {
      const response = await createEvent({ client, body })
      if (response.error) throw new Error('Failed to create event')
      if (!response.data) throw new Error('No data returned')
      const event = response.data

      if (entries.length > 0) {
        const entryResponse = await createEventEntries({
          client,
          body: entries.map((entry) => ({ ...entry, event_id: event.id }))
        })
        if (entryResponse.error)
          throw new Error('Failed to create event entries')
      }

      if (linkedTransactionIds.length > 0) {
        const linkResponse = await updateTransactions({
          client,
          body: linkedTransactionIds.map((id) => ({ id, event_id: event.id }))
        })
        if (linkResponse.error)
          throw new Error('Failed to update linked transactions')
      }

      return event
    },
    onSuccess: () => {
      toast.success('Event created')
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: (error) => {
      console.error(error)
      toast.error('Failed to create event', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred'
      })
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

  // Backs the FAB's event field, so only fetched once the sheet opens.
  const { data: events } = useQuery({
    queryKey: ['events'],
    enabled: fabOpen,
    queryFn: async () => {
      const response = await readEvents({ client })
      if (response.error) throw new Error('Failed to fetch events')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  // Back the nested "New event" sheet, so only fetched once the FAB opens.
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    enabled: fabOpen,
    queryFn: async () => {
      const response = await readCategories({ client })
      if (response.error) throw new Error('Failed to fetch categories')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  const { data: currencies } = useQuery({
    queryKey: ['currencies'],
    enabled: fabOpen,
    queryFn: async () => {
      const response = await readCurrencies({ client })
      if (response.error) throw new Error('Failed to fetch currencies')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  const {
    isError: isTransactionsError,
    isPending: isTransactionsPending,
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
        client={client}
        accounts={accounts ?? []}
        account={account}
        categories={categories ?? []}
        currencies={currencies ?? []}
        events={events}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingTransaction={editingTransaction}
        onSubmit={mutate}
        onCreateEvent={(body, linkedTransactionIds, entries) =>
          createEventMutation.mutateAsync({
            body,
            linkedTransactionIds,
            entries
          })
        }
        isPending={isPending}
        isCreatingEvent={createEventMutation.isPending}
      />
    </>
  )
}
