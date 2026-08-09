import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CreateAccountFab } from '@/components/create-account-fab'
import { Separator } from '@/components/ui/separator'
import {
  createAccountMutation,
  readAccountsOptions,
  readAccountsQueryKey,
  readCurrenciesOptions
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { cn, formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/_auth/account/')({
  component: AccountListPage
})

function AccountListPage() {
  const queryClient = useQueryClient()
  const [fabOpen, setFabOpen] = useState(false)

  const { data: accounts } = useQuery({
    ...readAccountsOptions(),
    meta: { errorMessage: 'Failed to fetch accounts' }
  })

  // Backs the FAB's currency field, so only fetched once the sheet opens.
  const { data: currencies } = useQuery({
    ...readCurrenciesOptions(),
    enabled: fabOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  const { mutate, isPending } = useMutation({
    ...createAccountMutation(),
    onSuccess: () => {
      toast.success('Account created')
      queryClient.invalidateQueries({ queryKey: readAccountsQueryKey() })
      setFabOpen(false)
    },
    meta: { errorMessage: 'Failed to create account' }
  })

  return (
    <div className="w-full">
      {accounts?.map((account, index) => {
        const balance = parseFloat(account.balance)
        const isNegative = balance < 0

        return (
          <div key={account.id}>
            {index > 0 && <Separator />}
            <Link
              to="/account/$id/transaction"
              params={{ id: account.id.toString() }}
              className="flex items-center gap-3 py-3 hover:bg-muted/50 -mx-4 px-4 transition-colors"
            >
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
            </Link>
          </div>
        )
      })}

      {accounts?.length === 0 && (
        <p className="text-muted-foreground p-4 text-sm">No accounts found.</p>
      )}

      <CreateAccountFab
        currencies={currencies ?? []}
        open={fabOpen}
        onOpenChange={setFabOpen}
        onSubmit={(body) => mutate({ body })}
        isPending={isPending}
      />
    </div>
  )
}
