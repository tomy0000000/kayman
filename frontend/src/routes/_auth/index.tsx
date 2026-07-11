import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { CreateEventFab } from '@/components/create-event-fab'
import { EventsTable } from '@/components/events-table'
import { Calendar } from '@/components/ui/calendar'
import { readEvents } from '@/lib/client'

export const Route = createFileRoute('/_auth/')({
  component: HomePage
})

function HomePage() {
  const { client } = Route.useRouteContext()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const eventDate = date?.toLocaleDateString('en-CA') // 2025-01-01

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
          <EventsTable client={client} events={events} isPending={isPending} />
        </div>
      </div>

      <CreateEventFab client={client} />
    </>
  )
}
