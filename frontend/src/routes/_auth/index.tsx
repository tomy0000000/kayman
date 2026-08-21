import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  EventSheet,
  type EventSheetState
} from '@/components/event/event-sheet'
import { EventsTable } from '@/components/event/events-table'
import { Fab } from '@/components/fab'
import { ResponsiveCalendar } from '@/components/responsive-calendar'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { type EventCreate, createEvent, updateEvent } from '@/lib/client'
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
  zonedCalendarGridRange,
  zonedDayKey,
  zonedDayRange
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

  const gridRange = zonedCalendarGridRange(month, timezone)
  const dayRange = date ? zonedDayRange(date, timezone) : undefined

  // The state outlives `open` so the sheet keeps its body while closing.
  const [sheet, setSheet] = useState<{
    open: boolean
    state: EventSheetState
  }>({ open: false, state: { mode: 'new' } })

  const editingEvent = sheet.state.mode === 'edit' ? sheet.state.event : null

  const openSheet = (state: EventSheetState) => setSheet({ open: true, state })

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
      setSheet((current) => ({ ...current, open: false }))
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

  // Two separate reads: the grid query only feeds the calendar's dots, so it
  // stays out of the table's loading path and keeps showing the previous
  // month's marks while it refetches. The table reads just the selected day.
  const { isPending: isGridPending, data: gridEvents } = useQuery({
    ...readEventsOptions({ query: gridRange }),
    placeholderData: keepPreviousData,
    meta: { errorMessage: 'Failed to fetch events' }
  })

  const { isPending: isDayPending, data: dayEvents } = useQuery({
    ...readEventsOptions({ query: dayRange }),
    enabled: dayRange !== undefined,
    meta: { errorMessage: 'Failed to fetch events' }
  })

  const eventDays = useMemo(
    () =>
      new Set(
        gridEvents?.map((event) => zonedDayKey(event.timestamp, timezone))
      ),
    [gridEvents, timezone]
  )

  // With no day picked the table falls back to the whole grid.
  const visibleEvents = dayRange ? dayEvents : gridEvents
  const isPending = dayRange ? isDayPending : isGridPending

  const isFormOpen = sheet.open && sheet.state.mode !== 'view'

  const { data: accounts } = useQuery({
    ...readAccountsOptions(),
    enabled: sheet.open
  })

  const { data: currencies } = useQuery({
    ...readCurrenciesOptions(),
    enabled: isFormOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  const { data: transactionTags } = useQuery({
    ...readTransactionTagsOptions(),
    enabled: isFormOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  // Categories back both the form and the table's summary column.
  const { data: categories } = useQuery({
    ...readCategoriesOptions(),
    staleTime: REFERENCE_STALE_TIME
  })

  // An id -> name lookup so entries (which reference `category_id`) can render
  // names.
  const categoryNames = useMemo(
    () =>
      new Map(
        (categories ?? []).map((category) => [category.id, category.name])
      ),
    [categories]
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <ResponsiveCalendar
          date={date}
          onDateSelect={handleDateSelect}
          month={month}
          onMonthChange={setMonth}
          eventDays={eventDays}
        />

        <div className="w-full">
          <EventsTable
            events={visibleEvents}
            categoryNames={categoryNames}
            isPending={isPending}
            onEventView={(event) => openSheet({ mode: 'view', event })}
            onEventEdit={(event) => openSheet({ mode: 'edit', event })}
            onEventDuplicate={(event) =>
              openSheet({ mode: 'duplicate', event })
            }
          />
        </div>
      </div>

      <Fab
        hotkey="n"
        label="New event"
        onOpen={() => openSheet({ mode: 'new' })}
      />

      <EventSheet
        open={sheet.open}
        state={sheet.state}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        accounts={accounts ?? []}
        categories={categories ?? []}
        categoryNames={categoryNames}
        currencies={currencies ?? []}
        transactionTags={transactionTags ?? []}
        seedDate={date}
        onSubmit={(body, transactions, entries) =>
          mutate({ body, transactions, entries })
        }
        isPending={isMutationPending}
      />
    </>
  )
}
