import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { EventFab } from '@/components/event/event-fab'
import { EventsTable } from '@/components/event/events-table'
import { Calendar } from '@/components/ui/calendar'
import {
  type EventCreate,
  type EventReadDetailed,
  createEvent,
  createEventEntries,
  updateEvent
} from '@/lib/client'
import {
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsOptions,
  readEventsQueryKey,
  readTransactionsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'
import { syncEventTransactions } from '@/lib/events'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'
import { parseLocalDate } from '@/lib/utils'

const searchSchema = z.object({
  date: z.iso.date().optional()
})

export const Route = createFileRoute('/_auth/')({
  validateSearch: searchSchema,
  component: HomePage
})

function HomePage() {
  const { client } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()
  const { date: dateParam } = Route.useSearch()
  const [date, setDate] = useState<Date | undefined>(
    dateParam ? parseLocalDate(dateParam) : new Date()
  )

  const handleDateSelect = (next: Date | undefined) => {
    setDate(next)
    navigate({ search: { date: next?.toLocaleDateString('en-CA') } })
  }
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
      transactions,
      entries
    }: {
      body: EventCreate
      transactions: TransactionPayload[]
      entries: EventEntryPayload[]
    }) => {
      const { data: event } = editingEvent
        ? await updateEvent({
            client,
            path: { event_id: editingEvent.id },
            body,
            throwOnError: true
          })
        : await createEvent({ client, body, throwOnError: true })

      await syncEventTransactions({
        client,
        eventId: event.id,
        transactions,
        previousIds: editingEvent?.transactions.map((t) => t.id) ?? [],
        createdAt: body.timestamp
      })

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
      queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })
      queryClient.invalidateQueries({ queryKey: readTransactionsQueryKey() })
      setFabOpen(false)
    },
    meta: {
      errorMessage: `Failed to ${editingEvent ? 'update' : 'create'} event`
    }
  })

  const { isPending, data: events } = useQuery({
    ...readEventsOptions({ query: { event_date: eventDate } }),
    meta: { errorMessage: 'Failed to fetch events' }
  })

  const { data: accounts } = useQuery(readAccountsOptions())

  const { data: categories } = useQuery(readCategoriesOptions())

  const { data: currencies } = useQuery(readCurrenciesOptions())

  return (
    <>
      <div className="flex h-full gap-4">
        <div>
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={handleDateSelect}
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
        accounts={accounts ?? []}
        categories={categories ?? []}
        currencies={currencies ?? []}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingEvent={editingEvent}
        onSubmit={(body, transactions, entries) =>
          mutate({ body, transactions, entries })
        }
        isPending={isMutationPending}
      />
    </>
  )
}
