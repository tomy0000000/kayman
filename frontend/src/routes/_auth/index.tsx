import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
      if (response.error) throw new Error('Failed to fetch payments')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  useEffect(() => {
    if (!isError) return
    console.error(error)
    toast.error('Failed to fetch payments', {
      description:
        error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }, [isError, error])

  return (
    <div className="flex h-full">
      <div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md border"
        />
      </div>

      <ScrollArea className="h-full w-full rounded-md">
        <hgroup className="p-4 pb-0">
          <h1 className="text-lg font-semibold">Payments</h1>
          <h2 className="text-neutral-500">{date?.toLocaleDateString()}</h2>
        </hgroup>
        <div className="px-4">
          <Separator className="my-2" />
          {isPending && (
            <p className="text-center text-sm leading-10 text-neutral-500">
              Loading...
            </p>
          )}
          {events?.length === 0 && (
            <p className="text-center text-sm leading-10 text-neutral-500">
              No payments
            </p>
          )}
          {events?.map((event) => {
            const entriesTotal = event.entries.reduce(
              (sum, entry) => sum + Number(entry.amount) * entry.quantity,
              0
            )
            const transferAmount = event.transactions
              .map((txn) => txn.amount)
              .join(' / ')
            return (
              <div key={event.id}>
                <div className="flex flex-row justify-between text-sm">
                  <div className="flex flex-col">
                    <div className="font-semibold">{event.description}</div>
                    <div className="text-neutral-500">{event.description}</div>
                  </div>
                  <div className="flex items-center justify-center rounded-md bg-red-500 px-4 py-2 text-white">
                    {event.type === 'Expense' && `-${entriesTotal}`}
                    {event.type === 'Income' && `+${entriesTotal}`}
                    {event.type === 'Transfer' && transferAmount}
                  </div>
                </div>
                <Separator className="my-2" />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
