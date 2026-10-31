import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { LayoutGrid, List, Wallet } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { type RefObject, useRef, useState } from 'react'
import { z } from 'zod'

import {
  AccountCard,
  AccountCardSkeleton
} from '@/components/account/account-card'
import { AccountFab } from '@/components/account/account-fab'
import { DragHandle } from '@/components/drag-handle'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ACCOUNT_TYPES } from '@/lib/account-types'
import {
  type AccountCreate,
  type AccountRead,
  type AccountType,
  type CreateAccountData,
  type Options,
  type UpdateAccountsData
} from '@/lib/client'
import {
  createAccountMutation,
  readAccountsOptions,
  readAccountsQueryKey,
  readCurrenciesOptions,
  updateAccountsMutation
} from '@/lib/client/@tanstack/react-query.gen'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import {
  PLACEHOLDER_ID,
  cacheUpdate,
  useOptimisticMutation
} from '@/lib/optimistic'
import { cn, formatCurrency } from '@/lib/utils'

interface AccountRowProps {
  account: AccountRead
  constraints: RefObject<HTMLDivElement | null>
  onDrop: () => void
  onEdit: () => void
}

interface AccountReorderListProps {
  accounts: AccountRead[]
  onReorder: (next: AccountRead[]) => void
  onDrop: () => void
  onEdit: (account: AccountRead) => void
}

interface AccountGridCardProps {
  account: AccountRead
  onEdit: () => void
}

const GROUP_ORDER: AccountType[] = [
  'CREDIT_CARD',
  'CASH',
  'REWARD',
  'INVESTMENT'
]

const searchSchema = z.object({
  view: z.enum(['list', 'grid']).optional()
})

export const Route = createFileRoute('/_auth/account/')({
  head: () => ({
    meta: [{ title: 'Account · Kayman' }]
  }),
  validateSearch: searchSchema,
  component: AccountListPage
})

function AccountListPage() {
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()
  const { view = 'list' } = Route.useSearch()
  const [fabOpen, setFabOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRead | null>(null)

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

  const { mutate, isPending } = useOptimisticMutation(
    {
      ...createAccountMutation(),
      onSuccess: () => toast.add({ title: 'Account created', type: 'success' }),
      meta: { errorMessage: 'Failed to create account' }
    },
    [
      cacheUpdate<AccountRead[], Options<CreateAccountData>>(
        readAccountsQueryKey(),
        (accounts, { body }) => [
          ...accounts,
          {
            ...body,
            id: PLACEHOLDER_ID,
            balance: '0',
            created_at: new Date().toISOString()
          }
        ]
      )
    ]
  )

  const { mutate: update, isPending: isUpdatePending } = useOptimisticMutation(
    {
      ...updateAccountsMutation(),
      onSuccess: () => toast.add({ title: 'Account updated', type: 'success' }),
      meta: { errorMessage: 'Failed to update account' }
    },
    [
      cacheUpdate<AccountRead[], Options<UpdateAccountsData>>(
        readAccountsQueryKey(),
        (accounts, { body }) =>
          accounts.map((account) => {
            const patch = body.find(({ id }) => id === account.id)
            return patch
              ? {
                  ...account,
                  name: patch.name ?? account.name,
                  short_name: patch.short_name,
                  type: patch.type ?? account.type
                }
              : account
          })
      )
    ]
  )

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
  const createAccount = (body: AccountCreate) => {
    setFabOpen(false)
    mutate({ body: { ...body, index: accounts?.length ?? 0 } })
  }

  // Currency and timezone are left out, the backend does not update them.
  const submitAccount = (body: AccountCreate) => {
    if (!editingAccount) return createAccount(body)
    setFabOpen(false)
    update({
      body: [
        {
          id: editingAccount.id,
          name: body.name,
          short_name: body.short_name,
          type: body.type
        }
      ]
    })
  }

  const handleFabOpenChange = (open: boolean) => {
    if (open && !fabOpen) setEditingAccount(null)
    setFabOpen(open)
  }

  // The drag reorders the cached list so the rows follow the pointer. Each row
  // still carries the index the server has, which is what the drop diffs
  // against. A group's rows only swap among the slots that group already holds.
  const handleReorder = (type: AccountType, next: AccountRead[]) => {
    const queue = [...next]
    queryClient.setQueryData<AccountRead[]>(readAccountsQueryKey(), (current) =>
      current?.map((account) =>
        account.type === type ? (queue.shift() ?? account) : account
      )
    )
  }

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

  const editAccount = (account: AccountRead) => {
    setEditingAccount(account)
    setFabOpen(true)
  }

  const groups = GROUP_ORDER.map((type) => ({
    type,
    meta: ACCOUNT_TYPES.find((t) => t.value === type),
    accounts: accounts?.filter((account) => account.type === type) ?? []
  })).filter((group) => group.accounts.length > 0)

  return (
    <div className="w-full">
      <div className="flex justify-end pb-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={view}
          onValueChange={(next) => {
            // Radix reports an empty value when the active item is clicked again.
            if (next) {
              navigate({
                search: { view: next === 'list' ? undefined : 'grid' }
              })
            }
          }}
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === 'grid' && isAccountsPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <AccountCardSkeleton key={index} />
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-6">
          {groups.map(({ type, meta, accounts: groupAccounts }) => (
            <section key={type} className="flex flex-col gap-2">
              {meta && (
                <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <meta.icon className="size-4" />
                  {meta.label}
                </h2>
              )}

              {view === 'grid' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupAccounts.map((account) => (
                    <AccountGridCard
                      key={account.id}
                      account={account}
                      onEdit={() => editAccount(account)}
                    />
                  ))}
                </div>
              ) : (
                <AccountReorderList
                  accounts={groupAccounts}
                  onReorder={(next) => handleReorder(type, next)}
                  onDrop={persistOrder}
                  onEdit={editAccount}
                />
              )}
            </section>
          ))}
        </div>
      )}

      {view === 'list' && isAccountsPending && (
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

      {!isAccountsPending && accounts?.length === 0 && (
        <p className="text-muted-foreground p-4 text-sm">No accounts found.</p>
      )}

      <AccountFab
        currencies={currencies ?? []}
        open={fabOpen}
        onOpenChange={handleFabOpenChange}
        editingAccount={editingAccount}
        onSubmit={submitAccount}
        isPending={isPending || isUpdatePending}
      />
    </div>
  )
}

function AccountReorderList({
  accounts,
  onReorder,
  onDrop,
  onEdit
}: AccountReorderListProps) {
  const list = useRef<HTMLDivElement>(null)

  return (
    <Reorder.Group
      as="div"
      ref={list}
      axis="y"
      values={accounts}
      onReorder={onReorder}
      className="[&>*:last-child]:border-0"
    >
      {accounts.map((account) => (
        <AccountRow
          key={account.id}
          account={account}
          constraints={list}
          onDrop={onDrop}
          onEdit={() => onEdit(account)}
        />
      ))}
    </Reorder.Group>
  )
}

function AccountRow({ account, constraints, onDrop, onEdit }: AccountRowProps) {
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
      className={cn(
        'bg-background relative -mx-4 flex items-center border-b',
        account.id < 0 && 'pointer-events-none opacity-50'
      )}
    >
      <DragHandle dragControls={dragControls} className="px-2" />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            to="/account/$id"
            params={{ id: account.id.toString() }}
            onClick={(clickEvent) => {
              // The long press that opens the context menu also ends in a click.
              if (clickEvent.currentTarget.dataset.state === 'open') {
                clickEvent.preventDefault()
              }
            }}
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
        </ContextMenuTrigger>
        <ContextMenuContent
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <ContextMenuItem onSelect={onEdit}>Edit</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Reorder.Item>
  )
}

function AccountGridCard({ account, onEdit }: AccountGridCardProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          to="/account/$id"
          params={{ id: account.id.toString() }}
          onClick={(clickEvent) => {
            // The long press that opens the context menu also ends in a click.
            if (clickEvent.currentTarget.dataset.state === 'open') {
              clickEvent.preventDefault()
            }
          }}
          className={cn(
            'rounded-xl',
            account.id < 0 && 'pointer-events-none opacity-50'
          )}
        >
          <AccountCard
            account={account}
            className="hover:bg-muted/50 h-full transition-colors"
          />
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={(event) => event.preventDefault()}>
        <ContextMenuItem onSelect={onEdit}>Edit</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
