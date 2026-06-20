import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { Separator } from '@/components/ui/separator'
import { readAccounts } from '@/lib/client'
import { cn, formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/account/')({
  component: AccountListPage
})

function AccountListPage() {
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
    <div className="w-full">
      {accounts?.map((account, index) => {
        const balance = parseFloat(account.balance)
        const isNegative = balance < 0

        return (
          <div key={account.id}>
            {index > 0 && <Separator />}
            <div className="flex items-center gap-3 py-3">
              <Wallet className="text-muted-foreground size-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{account.name}</div>
                <div
                  className={cn(
                    'text-sm',
                    isNegative ? 'text-red-500' : 'text-green-500'
                  )}
                >
                  {isNegative
                    ? `(${formatCurrency(Math.abs(balance), account.currency_code)})`
                    : formatCurrency(balance, account.currency_code)}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {accounts?.length === 0 && (
        <p className="text-muted-foreground p-4 text-sm">No accounts found.</p>
      )}
    </div>
  )
}
