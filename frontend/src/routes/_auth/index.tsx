import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EventFab } from '@/components/event-fab'
import { EventsTable } from '@/components/events-table'
import { Calendar } from '@/components/ui/calendar'
import {
  type EventCreate,
  type EventEntryCreate,
  type EventReadDetailed,
  createEvent,
  createEventEntries,
  readAccounts,
  readCategories,
  readCurrencies,
  readEvents,
  updateEvent,
  updateTransactions
} from '@/lib/client'

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
      const response = editingEvent
        ? await updateEvent({
            client,
            path: { event_id: editingEvent.id },
            body
          })
        : await createEvent({ client, body })
      if (response.error)
        throw new Error(`Failed to ${editingEvent ? 'update' : 'create'} event`)
      if (!response.data) throw new Error('No data returned')
      const event = response.data

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
        const linkResponse = await updateTransactions({ client, body: updates })
        if (linkResponse.error)
          throw new Error('Failed to update linked transactions')
      }

      // The API can only batch-create entries, so they are only sent for a new
      // event. An existing event's entries are read-only in the sheet.
      if (!editingEvent && entries.length > 0) {
        const entryResponse = await createEventEntries({
          client,
          body: entries.map((entry) => ({ ...entry, event_id: event.id }))
        })
        if (entryResponse.error)
          throw new Error('Failed to create event entries')
      }

      return event
    },
    onSuccess: () => {
      toast.success(`Event ${editingEvent ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
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
  } = useQuery({
    queryKey: ['events', eventDate],
    queryFn: async () => {
      const response = await readEvents({
        client,
        query: { event_date: eventDate }
      })
      if (response.error) throw new Error('Failed to fetch events')
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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await readCategories({ client })
      if (response.error) throw new Error('Failed to fetch categories')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  const { data: currencies } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const response = await readCurrencies({ client })
      if (response.error) throw new Error('Failed to fetch currencies')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

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
            client={client}
            events={events}
            isPending={isPending}
            onEventClick={handleEventClick}
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
