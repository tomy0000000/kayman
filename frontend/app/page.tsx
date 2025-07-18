'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { readPayments } from '@/lib/client'
import { useAuth } from '@/lib/context/AuthContext'

export default function CalendarApp() {
  const { client } = useAuth()
  const { toast } = useToast()
  const [date, setDate] = useState<Date | undefined>(new Date())

  const {
    isPending,
    isError,
    data: payments,
    error
  } = useQuery({
    queryKey: ['payments', date, client],
    queryFn: async () => {
      if (!client) {
        throw new Error('Not login yet')
      }
      const payment_date = date?.toLocaleDateString('en-CA') // 2025-01-01
      const response = await readPayments({
        client,
        query: { payment_date }
      })
      if (response.error) {
        throw new Error('Failed to fetch payments')
      }
      if (!response.data) {
        throw new Error('No data returned')
      }
      return response.data
    }
  })

  useEffect(() => {
    if (isError) {
      console.error(error)
      toast({
        title: 'Failed to fetch payments',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      })
    }
  }, [isError, error, toast])

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
            <p className="tex-sm text-center text-neutral-500 leading-10">
              Loading...
            </p>
          )}
          {payments?.length === 0 && (
            <p className="tex-sm text-center text-neutral-500 leading-10">
              No payments
            </p>
          )}
          {payments?.map((payment) => {
            const entriesTotal = payment.entries.reduce((sum, entry) => {
              return sum + Number(entry.amount) * entry.quantity
            }, 0)
            const transferAmount = payment.transactions
              .map((txn) => txn.amount)
              .join(' / ')
            return (
              <div key={payment.id}>
                <div className="flex flex-row justify-between text-sm">
                  <div className="flex flex-col">
                    <div className="font-semibold">{payment.description}</div>
                    <div className="text-neutral-500">
                      {payment.description}
                    </div>
                  </div>
                  <div className="flex items-center justify-center bg-red-500 text-white px-4 py-2 rounded-md">
                    {payment.type === 'Expense' && `-${entriesTotal}`}
                    {payment.type === 'Income' && `+${entriesTotal}`}
                    {payment.type === 'Transfer' && transferAmount}
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
