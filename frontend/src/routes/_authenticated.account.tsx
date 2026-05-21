import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useEffect } from 'react'
import { toast } from 'sonner'

import { DatePickerWithRange } from '@/components/date-range-picker'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { readAccounts } from '@/lib/client'

export const Route = createFileRoute('/_authenticated/account')({
  component: AccountPage
})

const transactions = [
  { title: 'Payment 1', date: new Date('2024-12-30'), amount: 100 },
  { title: 'Payment 2', date: new Date('2025-01-02'), amount: -200 }
]

function AccountPage() {
  const { client } = Route.useRouteContext()

  const {
    isError,
    data: accounts,
    error
  } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await readAccounts({ client })
      if (response.error) throw new Error('Failed to fetch accounts')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  useEffect(() => {
    if (!isError) return
    console.error(error)
    toast.error('Failed to fetch accounts', {
      description:
        error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }, [isError, error])

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel>
        <ScrollArea className="h-full">
          <h1 className="text-lg font-semibold">Accounts</h1>
          <ul>
            <Separator className="my-2" />
            {accounts?.map((account) => (
              <Fragment key={account.id}>
                <li className="text-sm">
                  <div className="font-semibold">{account.name}</div>
                  <div className="text-sm">{account.balance}</div>
                </li>
                <Separator className="my-2" />
              </Fragment>
            ))}
          </ul>
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <div className="flex-1 p-4">
          <ScrollArea className="h-full w-full rounded-md">
            <DatePickerWithRange />
            {transactions.map((transaction) => (
              <Fragment key={transaction.title}>
                <div className="text-sm">
                  <div className="font-semibold">{transaction.title}</div>
                  <div className="text-neutral-500">
                    {transaction.date.toLocaleDateString()}
                  </div>
                  <div className="text-sm">
                    {transaction.amount > 0 ? '+' : '-'}$
                    {Math.abs(transaction.amount)}
                  </div>
                </div>
                <Separator className="my-2" />
              </Fragment>
            ))}
          </ScrollArea>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
