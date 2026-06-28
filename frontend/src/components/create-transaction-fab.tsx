import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AccountSelect } from '@/components/account-select'
import { FabForm } from '@/components/fab-form'
import { FabSheet } from '@/components/fab-sheet'
import { TimePicker } from '@/components/time-picker'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  type AccountRead,
  type TransactionCreate,
  createTransaction
} from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { toLocalDateTimeInputValue } from '@/lib/utils'

export function CreateTransactionFab({
  client,
  account
}: {
  client: Client
  account?: AccountRead
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [pickedAccount, setPickedAccount] = useState<AccountRead | null>(null)
  const [createdAtLocal, setCreatedAtLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date())
  )

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null

  const reset = () => {
    setAmount('')
    setPickedAccount(null)
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
      queryClient.invalidateQueries({ queryKey: ['events'] })
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

  const handleCreate = () => {
    if (selectedAccount == null) return
    mutate({
      account_id: selectedAccount.id,
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
      <FabForm
        onSubmit={handleCreate}
        isPending={isPending}
        disabled={selectedAccount == null || amount === ''}
      >
        <Field>
          <FieldLabel htmlFor="txn-account">Account</FieldLabel>
          <AccountSelect
            id="txn-account"
            client={client}
            value={selectedAccount}
            onValueChange={setPickedAccount}
          />
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
              <InputGroupText>{selectedAccount?.currency_code}</InputGroupText>
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
      </FabForm>
    </FabSheet>
  )
}
