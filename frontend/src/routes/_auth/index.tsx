import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { z } from 'zod'

import { EventDeleteDialog } from '@/components/event/event-delete-dialog'
import { EventSheet } from '@/components/event/event-sheet'
import { EventsTable } from '@/components/event/events-table'
import { Fab } from '@/components/fab'
import { ResponsiveCalendar } from '@/components/responsive-calendar'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { useEventActions } from '@/hooks/use-event-actions'
import { readEventsOptions } from '@/lib/client/@tanstack/react-query.gen'
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
  head: () => ({
    meta: [{ title: 'Calendar · Kayman' }]
  }),
  validateSearch: searchSchema,
  component: HomePage
})

function HomePage() {
  const { client } = Route.useRouteContext()
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

  const {
    categoryNames,
    openSheet,
    tableHandlers,
    sheetProps,
    deleteDialogProps
  } = useEventActions(client)

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
            {...tableHandlers}
          />
        </div>
      </div>

      <Fab
        hotkey="n"
        label="New event"
        onOpen={() => openSheet({ mode: 'new' })}
      />

      <EventSheet {...sheetProps} seedDate={date} />

      <EventDeleteDialog {...deleteDialogProps} />
    </>
  )
}
