import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EventFab } from '@/components/event/event-fab'
import { EventsTable } from '@/components/event/events-table'
import { Calendar } from '@/components/ui/calendar'
import {
  type EventCreate,
  type EventEntryCreate,
  type EventReadDetailed,
  createEvent,
  createEventEntries,
  updateEvent,
  updateTransactions
} from '@/lib/client'
import {
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsOptions,
  readEventsQueryKey,
  readTransactionsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'

export const Route = createFileRoute('/_auth/')({
  component: HomePage
})

function HomePage() {
  const { client } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const eventDate = date?.toLocaleDateString('en-CA') // 2025-01-01

  const [fabOpen, setFabOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventReadDetailed | null>(
    null
  )

  const handleFabOpenChange = (open: boolean) => {
    setFabOpen(open)
    if (open) setEditingEvent(null)
  }

  const handleEventClick = (event: EventReadDetailed) => {
    setEditingEvent(event)
    setFabOpen(true)
  }

  const { mutate, isPending: isMutationPending } = useMutation({
    mutationFn: async ({
      body,
      linkedTransactionIds,
      entries
    }: {
      body: EventCreate
      linkedTransactionIds: number[]
      entries: Omit<EventEntryCreate, 'event_id'>[]
    }) => {
      const { data: event } = editingEvent
        ? await updateEvent({
            client,
            path: { event_id: editingEvent.id },
            body,
            throwOnError: true
          })
        : await createEvent({ client, body, throwOnError: true })

      const previousIds = editingEvent?.transactions.map((t) => t.id) ?? []
      const nextIds = new Set(linkedTransactionIds)
      const updates = [
        ...linkedTransactionIds
          .filter((id) => !previousIds.includes(id))
          .map((id) => ({ id, event_id: event.id })),
        ...previousIds
          .filter((id) => !nextIds.has(id))
          .map((id) => ({ id, event_id: null }))
      ]
      if (updates.length > 0) {
        await updateTransactions({ client, body: updates, throwOnError: true })
      }

      // The API can only batch-create entries, so they are only sent for a new
      // event. An existing event's entries are read-only in the sheet.
      if (!editingEvent && entries.length > 0) {
        await createEventEntries({
          client,
          body: entries.map((entry) => ({ ...entry, event_id: event.id })),
          throwOnError: true
        })
      }

      return event
    },
    onSuccess: () => {
      toast.success(`Event ${editingEvent ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({
        queryKey: readEventsQueryKey({ client })
      })
      queryClient.invalidateQueries({
        queryKey: readTransactionsQueryKey({ client })
      })
      setFabOpen(false)
    },
    onError: (error) => {
      console.error(error)
      toast.error(`Failed to ${editingEvent ? 'update' : 'create'} event`, {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })

  const {
    isPending,
    isError,
    data: events,
    error
  } = useQuery(readEventsOptions({ client, query: { event_date: eventDate } }))

  const { data: accounts } = useQuery(readAccountsOptions({ client }))

  const { data: categories } = useQuery(readCategoriesOptions({ client }))

  const { data: currencies } = useQuery(readCurrenciesOptions({ client }))

  useEffect(() => {
    if (!isError) return
    console.error(error)
    toast.error('Failed to fetch events', {
      description:
        error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }, [isError, error])

  return (
    <>
      <div className="flex h-full gap-4">
        <div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
          />
        </div>

        <div className="w-full">
          <EventsTable
            events={events}
            accounts={accounts ?? []}
            categories={categories ?? []}
            isPending={isPending}
            onEventEdit={handleEventClick}
          />
        </div>
      </div>

      <EventFab
        client={client}
        accounts={accounts ?? []}
        categories={categories ?? []}
        currencies={currencies ?? []}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingEvent={editingEvent}
        onSubmit={(body, linkedTransactionIds, entries) =>
          mutate({ body, linkedTransactionIds, entries })
        }
        isPending={isMutationPending}
      />
    </>
  )
}
