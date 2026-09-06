import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { EventDeleteDialog } from '@/components/event/event-delete-dialog'
import { EventSheet } from '@/components/event/event-sheet'
import { EventsTable } from '@/components/event/events-table'
import { useEventActions } from '@/hooks/use-event-actions'
import { readEventsOptions } from '@/lib/client/@tanstack/react-query.gen'

export const Route = createFileRoute('/_auth/reconcile')({
  head: () => ({
    meta: [{ title: 'Reconcile · Kayman' }]
  }),
  component: ReconcilePage
})

function ReconcilePage() {
  const { client } = Route.useRouteContext()
  const { categoryNames, tableHandlers, sheetProps, deleteDialogProps } =
    useEventActions(client)

  // Every event still waiting to be reconciled, with no date bound: the
  // backlog is the point of the page.
  const { isPending, data: events } = useQuery({
    ...readEventsOptions({ query: { cleared_at: 'empty' } }),
    meta: { errorMessage: 'Failed to fetch events' }
  })

  return (
    <>
      <div className="w-full">
        <EventsTable
          events={events}
          categoryNames={categoryNames}
          isPending={isPending}
          showDate
          {...tableHandlers}
        />
      </div>

      <EventSheet {...sheetProps} />

      <EventDeleteDialog {...deleteDialogProps} />
    </>
  )
}
