import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { type RefObject, useRef, useState } from 'react'

import { CreateAccountFab } from '@/components/create-account-fab'
import { DragHandle } from '@/components/drag-handle'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { type AccountCreate, type AccountRead } from '@/lib/client'
import {
  createAccountMutation,
  readAccountsOptions,
  readAccountsQueryKey,
  readCurrenciesOptions,
  updateAccountsMutation
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { cn, formatCurrency } from '@/lib/utils'

interface AccountRowProps {
  account: AccountRead
  constraints: RefObject<HTMLDivElement | null>
  onDrop: () => void
}

export const Route = createFileRoute('/_auth/account/')({
  head: () => ({
    meta: [{ title: 'Account · Kayman' }]
  }),
  component: AccountListPage
})

function AccountListPage() {
  const queryClient = useQueryClient()
  const [fabOpen, setFabOpen] = useState(false)
  const list = useRef<HTMLDivElement>(null)

  const { isPending: isAccountsPending, data: accounts } = useQuery({
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
      toast.add({ title: 'Account created', type: 'success' })
      queryClient.invalidateQueries({ queryKey: readAccountsQueryKey() })
      setFabOpen(false)
    },
    meta: { errorMessage: 'Failed to create account' }
  })

  const { mutate: reorder } = useMutation({
    ...updateAccountsMutation(),
    // Either way the server order is the one to show: on success it matches
    // what was just sent, on failure the optimistic order snaps back.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: readAccountsQueryKey() }),
    meta: { errorMessage: 'Failed to reorder accounts' }
  })

  // Appended, not left at the default 0, which would sort a new account above
  // every row a reorder has already given an index.
  const createAccount = (body: AccountCreate) =>
    mutate({ body: { ...body, index: accounts?.length ?? 0 } })

  // The drag reorders the cached list so the rows follow the pointer. Each row
  // still carries the index the server has, which is what the drop diffs
  // against.
  const handleReorder = (next: AccountRead[]) =>
    queryClient.setQueryData(readAccountsQueryKey(), next)

  const persistOrder = () => {
    const current = queryClient.getQueryData<AccountRead[]>(
      readAccountsQueryKey()
    )
    if (!current) return

    const body = current
      .map((account, index) => ({ id: account.id, index }))
      .filter(({ index }) => current[index].index !== index)
    if (body.length === 0) return

    // Carry the sent indexes into the cache, so a second drag before the
    // refetch lands still diffs against what the server was told.
    queryClient.setQueryData(
      readAccountsQueryKey(),
      current.map((account, index) => ({ ...account, index }))
    )
    reorder({ body })
  }

  return (
    <div className="w-full">
      {isAccountsPending && (
        <div className="[&>*:last-child]:border-0">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="-mx-4 flex items-center gap-3 border-b px-4 py-3"
            >
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-4 w-24 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <Reorder.Group
          as="div"
          ref={list}
          axis="y"
          values={accounts}
          onReorder={handleReorder}
          className="[&>*:last-child]:border-0"
        >
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              constraints={list}
              onDrop={persistOrder}
            />
          ))}
        </Reorder.Group>
      )}

      {!isAccountsPending && accounts?.length === 0 && (
        <p className="text-muted-foreground p-4 text-sm">No accounts found.</p>
      )}

      <CreateAccountFab
        currencies={currencies ?? []}
        open={fabOpen}
        onOpenChange={setFabOpen}
        onSubmit={createAccount}
        isPending={isPending}
      />
    </div>
  )
}

function AccountRow({ account, constraints, onDrop }: AccountRowProps) {
  const dragControls = useDragControls()

  const balance = parseFloat(account.balance)
  const isNegative = balance < 0

  return (
    <Reorder.Item
      as="div"
      value={account}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraints}
      dragElastic={0}
      onDragEnd={onDrop}
      className="bg-background relative -mx-4 flex items-center border-b"
    >
      <DragHandle dragControls={dragControls} className="px-2" />
      <Link
        to="/account/$id/transaction"
        params={{ id: account.id.toString() }}
        className="hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 transition-colors"
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
    </Reorder.Item>
  )
}
