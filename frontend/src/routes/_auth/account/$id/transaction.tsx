import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useEffect, useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { toast } from 'sonner'

import { Amount } from '@/components/amount'
import { CreateTransactionFab } from '@/components/create-transaction-fab'
import { DatePickerWithRange } from '@/components/date-range-picker'
import { Separator } from '@/components/ui/separator'
import { type TransactionRead, readAccount } from '@/lib/client'
import { cn, formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/_auth/account/$id/transaction')(
  {
    component: AccountTransactionPage
  }
)

const transactions: Array<TransactionRead & { status?: string | null }> = [
  {
    id: 12,
    account_id: 1,
    created_at: '2025-01-02T21:09:00Z',
    description: 'Adjustment',
    amount: '0',
    payment_id: 4,
    index: 12
  },
  {
    id: 11,
    account_id: 1,
    created_at: '2025-01-02T18:34:00Z',
    description: 'Pharmacy',
    amount: '-12.86',
    payment_id: 4,
    index: 11
  },
  {
    id: 10,
    account_id: 1,
    created_at: '2025-01-02T10:11:00Z',
    description: 'Rent',
    amount: '-1800.00',
    payment_id: 4,
    index: 10
  },
  {
    id: 12,
    account_id: 1,
    created_at: '2025-01-02T21:09:00Z',
    description: 'Adjustment',
    amount: '0',
    payment_id: 4,
    index: 12
  },
  {
    id: 11,
    account_id: 1,
    created_at: '2025-01-02T18:34:00Z',
    description: 'Pharmacy',
    amount: '-12.86',
    payment_id: 4,
    index: 11
  },
  {
    id: 10,
    account_id: 1,
    created_at: '2025-01-02T10:11:00Z',
    description: 'Rent',
    amount: '-1800.00',
    payment_id: 4,
    index: 10
  },
  {
    id: 12,
    account_id: 1,
    created_at: '2025-01-02T21:09:00Z',
    description: 'Adjustment',
    amount: '0',
    payment_id: 4,
    index: 12
  },
  {
    id: 11,
    account_id: 1,
    created_at: '2025-01-02T18:34:00Z',
    description: 'Pharmacy',
    amount: '-12.86',
    payment_id: 4,
    index: 11
  },
  {
    id: 10,
    account_id: 1,
    created_at: '2025-01-02T10:11:00Z',
    description: 'Rent',
    amount: '-1800.00',
    payment_id: 4,
    index: 10
  },
  {
    id: 12,
    account_id: 1,
    created_at: '2025-01-02T21:09:00Z',
    description: 'Adjustment',
    amount: '0',
    payment_id: 4,
    index: 12
  },
  {
    id: 11,
    account_id: 1,
    created_at: '2025-01-02T18:34:00Z',
    description: 'Pharmacy',
    amount: '-12.86',
    payment_id: 4,
    index: 11
  },
  {
    id: 10,
    account_id: 1,
    created_at: '2025-01-02T10:11:00Z',
    description: 'Rent',
    amount: '-1800.00',
    payment_id: 4,
    index: 10
  },
  {
    id: 12,
    account_id: 1,
    created_at: '2025-01-02T21:09:00Z',
    description: 'Adjustment',
    amount: '0',
    payment_id: 4,
    index: 12
  },
  {
    id: 11,
    account_id: 1,
    created_at: '2025-01-02T18:34:00Z',
    description: 'Pharmacy',
    amount: '-12.86',
    payment_id: 4,
    index: 11
  },
  {
    id: 10,
    account_id: 1,
    created_at: '2025-01-02T10:11:00Z',
    description: 'Rent',
    amount: '-1800.00',
    payment_id: 4,
    index: 10
  },
  {
    id: 9,
    account_id: 1,
    created_at: '2025-01-02T07:48:00Z',
    description: 'Payroll deposit',
    amount: '2450.00',
    payment_id: 4,
    index: 9
  },
  {
    id: 8,
    account_id: 1,
    created_at: '2025-01-01T16:22:00Z',
    description: 'Movie tickets',
    amount: '-28.50',
    payment_id: 3,
    index: 8
  },
  {
    id: 7,
    account_id: 1,
    created_at: '2025-01-01T11:00:00Z',
    description: 'Brunch',
    amount: '-44.20',
    payment_id: 3,
    index: 7
  },
  {
    id: 6,
    account_id: 1,
    created_at: '2024-12-31T23:55:00Z',
    description: 'NYE dinner',
    amount: '-128.00',
    payment_id: 2,
    index: 6
  },
  {
    id: 5,
    account_id: 1,
    created_at: '2024-12-31T14:18:00Z',
    description: 'Gas station',
    amount: '-52.30',
    payment_id: 2,
    index: 5
  },
  {
    id: 4,
    account_id: 1,
    created_at: '2024-12-31T09:30:00Z',
    description: 'Refund: returned monitor',
    amount: '249.99',
    payment_id: 2,
    status: 'reconciled',
    index: 4
  },
  {
    id: 3,
    account_id: 1,
    created_at: '2024-12-30T19:05:00Z',
    description: 'Grocery run',
    amount: '-86.40',
    payment_id: 1,
    status: 'statement',
    index: 3
  },
  {
    id: 2,
    account_id: 1,
    created_at: '2024-12-30T12:42:00Z',
    description: 'Lunch with team',
    amount: '-32.10',
    status: 'posted',
    payment_id: 1,
    index: 2
  },
  {
    id: 1,
    account_id: 1,
    created_at: '2024-12-30T08:15:00Z',
    description: 'Morning coffee',
    amount: '-4.75',
    status: 'pending',
    payment_id: 1,
    index: 1
  },
  {
    id: 3,
    account_id: 1,
    created_at: '2024-12-30T19:05:00Z',
    description: 'Grocery run',
    amount: '-86.40',
    payment_id: 1,
    status: 'statement',
    index: 3
  },
  {
    id: 2,
    account_id: 1,
    created_at: '2024-12-30T12:42:00Z',
    description: 'Lunch with team',
    amount: '-32.10',
    status: 'posted',
    payment_id: 1,
    index: 2
  },
  {
    id: 1,
    account_id: 1,
    created_at: '2024-12-30T08:15:00Z',
    description: 'Morning coffee',
    amount: '-4.75',
    status: 'pending',
    payment_id: 1,
    index: 1
  },
  {
    id: 3,
    account_id: 1,
    created_at: '2024-12-30T19:05:00Z',
    description: 'Grocery run',
    amount: '-86.40',
    payment_id: 1,
    status: 'statement',
    index: 3
  },
  {
    id: 2,
    account_id: 1,
    created_at: '2024-12-30T12:42:00Z',
    description: 'Lunch with team',
    amount: '-32.10',
    status: 'posted',
    payment_id: 1,
    index: 2
  },
  {
    id: 1,
    account_id: 1,
    created_at: '2024-12-30T08:15:00Z',
    description: 'Morning coffee',
    amount: '-4.75',
    status: 'pending',
    payment_id: 1,
    index: 1
  },
  {
    id: 3,
    account_id: 1,
    created_at: '2024-12-30T19:05:00Z',
    description: 'Grocery run',
    amount: '-86.40',
    payment_id: 1,
    status: 'statement',
    index: 3
  },
  {
    id: 2,
    account_id: 1,
    created_at: '2024-12-30T12:42:00Z',
    description: 'Lunch with team',
    amount: '-32.10',
    status: 'posted',
    payment_id: 1,
    index: 2
  },
  {
    id: 1,
    account_id: 1,
    created_at: '2024-12-30T08:15:00Z',
    description: 'Morning coffee',
    amount: '-4.75',
    status: 'pending',
    payment_id: 1,
    index: 1
  },
  {
    id: 3,
    account_id: 1,
    created_at: '2024-12-30T19:05:00Z',
    description: 'Grocery run',
    amount: '-86.40',
    payment_id: 1,
    status: 'statement',
    index: 3
  },
  {
    id: 2,
    account_id: 1,
    created_at: '2024-12-30T12:42:00Z',
    description: 'Lunch with team',
    amount: '-32.10',
    status: 'posted',
    payment_id: 1,
    index: 2
  },
  {
    id: 1,
    account_id: 1,
    created_at: '2024-12-30T08:15:00Z',
    description: 'Morning coffee',
    amount: '-4.75',
    status: 'pending',
    payment_id: 1,
    index: 1
  }
]

// Compute running balance per transaction (display is newest-first, so accumulate oldest→newest)
const runningBalances: number[] = (() => {
  const result = new Array(transactions.length)
  let bal = 0
  for (let i = transactions.length - 1; i >= 0; i--) {
    bal += parseFloat(transactions[i].amount)
    result[i] = bal
  }
  return result
})()

function AccountTransactionPage() {
  const { client } = Route.useRouteContext()
  const { id } = Route.useParams()
  const accountId = Number(id)

  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const {
    isError,
    data: account,
    error
  } = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const response = await readAccount({
        client,
        path: { account_id: accountId }
      })
      if (response.error) throw new Error('Failed to fetch account')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  useEffect(() => {
    if (!isError) return
    console.error(error)
    toast.error('Failed to fetch account', {
      description:
        error instanceof Error ? error.message : 'An unknown error occurred'
    })
  }, [isError, error])

  return (
    <>
      {/* Date Picker */}
      <div className="bg-background sticky top-0 z-10 pt-4">
        <div className="flex items-end gap-3 overflow-x-auto">
          <DatePickerWithRange
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
        </div>

        <Separator className="my-4 bg-foreground/30" />
      </div>

      {/* Transactions */}
      <div className="min-h-0 w-full flex-1 snap-y snap-mandatory overflow-y-auto scroll-pt-7 sm:scroll-pt-0">
        {transactions.map(function (transaction, index) {
          const timestamp = new Date(transaction.created_at)
          const amount = parseFloat(transaction.amount)
          const dateLabel = timestamp.toLocaleDateString()
          const prevDateLabel =
            index > 0
              ? new Date(transactions[index - 1].created_at).toLocaleDateString()
              : null
          const showDate = dateLabel !== prevDateLabel

          return (
            <Fragment key={transaction.id}>
              {/* Separator: full width on date change, indented only on >=sm */}
              {index > 0 && (
                <Separator
                  className={cn(
                    'my-2 snap-start',
                    !showDate && 'sm:ml-[calc(--spacing(24)+(--spacing(3)))]'
                  )}
                />
              )}

              {/* Narrow-viewport sticky date header */}
              {showDate && (
                <>
                  <div className="bg-background sticky top-0 z-5 py-1 text-sm font-semibold sm:hidden">
                    {dateLabel}
                  </div>
                  <Separator className="my-2 sm:hidden" />
                </>
              )}

              {/* Row — first row gets snap-start too so scrollTop=0 is a valid snap point */}
              <div
                className={cn(
                  'flex items-start gap-3 text-sm',
                  index === 0 && 'snap-start'
                )}
              >
                {/* Date — only on >=sm */}
                <div className="hidden w-24 shrink-0 text-neutral-500 sm:block">
                  {showDate ? dateLabel : ''}
                </div>

                {/* Time */}
                <div className="w-24 shrink-0 text-neutral-500">
                  {timestamp.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>

                {/* Description — only thing allowed to shrink/truncate */}
                <div className="min-w-0 flex-1 truncate font-semibold">
                  {transaction.description}
                </div>

                {/* Status */}
                <div className="text-muted-foreground shrink-0 text-xs">
                  {transaction.status}
                </div>

                {/* Amount + running balance */}
                <div className="flex w-24 shrink-0 flex-col items-end">
                  <Amount
                    amount={amount}
                    currencyCode={account?.currency_code}
                  />
                  <span className="text-muted-foreground text-xs">
                    {account
                      ? formatCurrency(
                          runningBalances[index],
                          account.currency_code
                        )
                      : runningBalances[index]}
                  </span>
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      <CreateTransactionFab client={client} />
    </>
  )
}
