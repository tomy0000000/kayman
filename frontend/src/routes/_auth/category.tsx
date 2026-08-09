import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useState } from 'react'
import { type DateRange } from 'react-day-picker'

import { Amount } from '@/components/amount'
import { DatePickerWithRange } from '@/components/date-range-picker'
import { Tree } from '@/components/tree'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { readCategoriesOptions } from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { categoryToTreeItem } from '@/lib/types'

export const Route = createFileRoute('/_auth/category')({
  component: CategoryPage
})

const transactions = [
  {
    title: 'Payment 1',
    date: new Date('2024-12-30'),
    amount: 100,
    currencyCode: 'USD'
  },
  {
    title: 'Payment 2',
    date: new Date('2025-01-02'),
    amount: -200,
    currencyCode: 'USD'
  }
]

function CategoryPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const { data: categories } = useQuery({
    ...readCategoriesOptions(),
    staleTime: REFERENCE_STALE_TIME,
    meta: { errorMessage: 'Failed to fetch categories' }
  })

  const treeData = categories?.map((category) =>
    categoryToTreeItem(category, 'root')
  )

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
                <Amount
                  className="text-sm"
                  amount={transaction.amount}
                  currencyCode={transaction.currencyCode}
                />
              </div>
              <Separator className="my-2" />
            </Fragment>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}
