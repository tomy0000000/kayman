import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  type TransactionCreate,
  type TransactionRead,
  readAccounts
} from '@/lib/client'
import type { Client } from '@/lib/client/client'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from './ui/input-group'

function toLocalDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function CreateTransactionFab({ client }: { client: Client }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [createdAtLocal, setCreatedAtLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date())
  )

  useHotkeys('n', () => setOpen(true), { preventDefault: true })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await readAccounts({ client })
      if (response.error) throw new Error('Failed to fetch accounts')
      if (!response.data) throw new Error('No data returned')
      return response.data
    },
    enabled: open
  })

  const selectedAccount = accounts?.find((a) => a.id === accountId)

  const reset = () => {
    setAmount('')
    setAccountId(null)
    setCreatedAtLocal(toLocalDateTimeInputValue(new Date()))
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: TransactionCreate) => {
      const response = await client.post<TransactionRead>({
        url: '/api/transactions',
        body,
        security: [{ scheme: 'bearer', type: 'http' }]
      })
      if (response.error) throw new Error('Failed to create transaction')
      if (!response.data) throw new Error('No data returned')
      return response.data
    },
    onSuccess: () => {
      toast.success('Transaction created')
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      reset()
      setOpen(false)
    },
    onError: (error) => {
      console.error(error)
      toast.error('Failed to create transaction', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (accountId == null) return
    mutate({
      account_id: accountId,
      amount,
      created_at: new Date(createdAtLocal).toISOString()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              size="icon-lg"
              className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg"
              aria-label="Create transaction"
            >
              <Plus className="size-6" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          New transaction
          <kbd
            data-slot="kbd"
            className="bg-background/15 ml-1 px-1.5 py-0.5 font-sans text-[10px] font-medium"
          >
            N
          </kbd>
        </TooltipContent>
      </Tooltip>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <FieldGroup className="flex-1 overflow-y-auto px-4">
            <Field>
              <FieldLabel htmlFor="txn-account">Account</FieldLabel>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="txn-account"
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                  >
                    {selectedAccount ? (
                      <span className="flex items-center gap-2">
                        <span className="font-medium">
                          {selectedAccount.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {selectedAccount.currency_code}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Select account
                      </span>
                    )}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-(--radix-dropdown-menu-trigger-width)"
                >
                  {accounts?.map((account) => (
                    <DropdownMenuItem
                      key={account.id}
                      onSelect={() => setAccountId(account.id)}
                    >
                      <span className="leading-none">{account.name}</span>
                      <span className="text-muted-foreground ml-auto text-xs leading-none">
                        {account.currency_code}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Field>

            <Field>
              <FieldLabel htmlFor="txn-amount">Amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="txn-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>
                    {selectedAccount?.currency_code}
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="txn-created-at">Timestamp</FieldLabel>
              <Input
                id="txn-created-at"
                type="datetime-local"
                value={createdAtLocal}
                onChange={(e) => setCreatedAtLocal(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>

          <SheetFooter>
            <Button
              type="submit"
              disabled={isPending || accountId == null || amount === ''}
            >
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
