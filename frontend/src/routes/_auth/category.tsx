import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useEffect, useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { toast } from 'sonner'

import { DatePickerWithRange } from '@/components/date-range-picker'
import { Tree } from '@/components/tree'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { readCategoriesOptions } from '@/lib/client/@tanstack/react-query.gen'
import { categoryToTreeItem } from '@/lib/types'

export const Route = createFileRoute('/_auth/category')({
  component: CategoryPage
})

const transactions = [
  { title: 'Payment 1', date: new Date('2024-12-30'), amount: 100 },
  { title: 'Payment 2', date: new Date('2025-01-02'), amount: -200 }
]

function CategoryPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const { isError, data: categories, error } = useQuery(readCategoriesOptions())

  const treeData = categories?.map((category) =>
    categoryToTreeItem(category, 'root')
  )

  useEffect(() => {
    if (!isError) return
    console.error(error)
    toast.error('Failed to fetch categories', {
      description:
        error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }, [isError, error])

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4">
        <Tree treeData={treeData} />
      </div>

      <Separator orientation="vertical" />

      <div className="flex-1 p-4">
        <ScrollArea className="h-full w-full rounded-md">
          <DatePickerWithRange
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
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
    </div>
  )
}
