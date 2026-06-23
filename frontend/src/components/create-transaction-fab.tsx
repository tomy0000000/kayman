import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Info } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FabSheet } from '@/components/fab-sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { SheetFooter } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  type TransactionCreate,
  createTransaction,
  readAccounts
} from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { toLocalDateTimeInputValue } from '@/lib/utils'

import { TimePicker } from '@/components/time-picker'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'

export function CreateTransactionFab({
  client,
  accountId: initialAccountId
}: {
  client: Client
  accountId?: number
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState<number | null>(
    initialAccountId ?? null
  )
  const [createdAtLocal, setCreatedAtLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date())
  )

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
    setAccountId(initialAccountId ?? null)
    setCreatedAtLocal(toLocalDateTimeInputValue(new Date()))
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: TransactionCreate) => {
      const response = await createTransaction({ client, body })
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
    <FabSheet
      open={open}
      onOpenChange={setOpen}
      hotkey="n"
      label="New transaction"
    >
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
            <FieldLabel
              htmlFor="txn-created-at"
              className="flex items-center gap-1.5"
            >
              Timestamp
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About timestamp"
                    className="text-muted-foreground"
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Timestamp will be converted to account's timezone before save
                </TooltipContent>
              </Tooltip>
            </FieldLabel>
            <TimePicker
              id="txn-created-at"
              value={createdAtLocal}
              onChange={setCreatedAtLocal}
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
    </FabSheet>
  )
}
