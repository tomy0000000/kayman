import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { EventFab } from '@/components/event/event-fab'
import { EventsTable } from '@/components/event/events-table'
import { ResponsiveCalendar } from '@/components/responsive-calendar'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type EventCreate,
  type EventReadDetailed,
  createEvent,
  updateEvent
} from '@/lib/client'
import {
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsOptions,
  readEventsQueryKey,
  readTransactionTagsOptions,
  readTransactionsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { syncEventEntries } from '@/lib/event-entries'
import { hasEventChanges, syncEventTransactions } from '@/lib/events'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'
import {
  formatCalendarDate,
  parseLocalDate,
  zonedCalendarDate,
  zonedDayRange,
  zonedMonthRange
} from '@/lib/utils'

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
  const { timezone } = useClientTimezone()
  const [date, setDate] = useState<Date | undefined>(
    dateParam
      ? parseLocalDate(dateParam)
      : zonedCalendarDate(new Date(), timezone)
  )
  const [month, setMonth] = useState<Date>(
    () => date ?? zonedCalendarDate(new Date(), timezone)
  )

  const handleDateSelect = (next: Date | undefined) => {
    setDate(next)
    navigate({ search: { date: next && formatCalendarDate(next) } })
  }

  const { start, end } = date
    ? zonedDayRange(date, timezone)
    : zonedMonthRange(month, timezone)

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
      let event: { id: number }
      if (!editingEvent) {
        const { data } = await createEvent({ client, body, throwOnError: true })
        event = data
      } else if (hasEventChanges(body, editingEvent)) {
        const { data } = await updateEvent({
          client,
          path: { event_id: editingEvent.id },
          body,
          throwOnError: true
        })
        event = data
      } else {
        // Only the transactions or entries changed, so the event needs no patch.
        event = editingEvent
      }

      await syncEventTransactions({
        client,
        eventId: event.id,
        transactions,
        previousTransactions: editingEvent?.transactions ?? [],
        createdAt: body.timestamp
      })

      await syncEventEntries({
        client,
        eventId: event.id,
        entries,
        previousEntries: editingEvent?.entries ?? []
      })

      return event
    },
    onSuccess: () => {
      toast.success(`Event ${editingEvent ? 'updated' : 'created'}`)
      setFabOpen(false)
    },
    // Settled, not success: the submit spans several calls, so a failure partway
    // can still have deleted or changed rows the table is now showing stale.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })
      queryClient.invalidateQueries({ queryKey: readTransactionsQueryKey() })
    },
    meta: {
      errorMessage: `Failed to ${editingEvent ? 'update' : 'create'} event`
    }
  })

  const { isPending, data: events } = useQuery({
    ...readEventsOptions({ query: { start, end } }),
    meta: { errorMessage: 'Failed to fetch events' }
  })

  // Back the FAB's form fields, so only fetched once the sheet opens.
  const { data: accounts } = useQuery({
    ...readAccountsOptions(),
    enabled: fabOpen
  })

  const { data: currencies } = useQuery({
    ...readCurrenciesOptions(),
    enabled: fabOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  const { data: transactionTags } = useQuery({
    ...readTransactionTagsOptions(),
    enabled: fabOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  // Categories back both the FAB and the table's summary column.
  const { data: categories } = useQuery({
    ...readCategoriesOptions(),
    staleTime: REFERENCE_STALE_TIME
  })

  return (
    <>
      <div className="flex flex-col gap-4">
        <ResponsiveCalendar
          date={date}
          onDateSelect={handleDateSelect}
          month={month}
          onMonthChange={setMonth}
        />

        <div className="w-full">
          <EventsTable
            events={events}
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
        transactionTags={transactionTags ?? []}
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
