import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AccountSelect } from '@/components/account-select'
import { FabForm } from '@/components/fab-form'
import { FabSheet } from '@/components/fab-sheet'
import { TimePicker } from '@/components/time-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  type AccountRead,
  type TransactionCreate,
  createTransaction
} from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { formatZonedDateTime, toZonedISOString } from '@/lib/utils'

const CLIENT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

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
  const [negative, setNegative] = useState(false)
  const [pickedAccount, setPickedAccount] = useState<AccountRead | null>(null)
  const [createdAt, setCreatedAt] = useState(() => new Date())

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null

  const zonedCreatedAt = useMemo(
    () =>
      selectedAccount
        ? toZonedISOString(createdAt, selectedAccount.timezone)
        : null,
    [createdAt, selectedAccount]
  )

  const reset = () => {
    setAmount('')
    setNegative(false)
    setPickedAccount(null)
    setCreatedAt(new Date())
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
    if (selectedAccount == null || zonedCreatedAt == null) return
    mutate({
      account_id: selectedAccount.id,
      amount: negative ? `-${amount}` : amount,
      created_at: zonedCreatedAt
    })
  }

  return (
    <FabSheet
      open={open}
      onOpenChange={setOpen}
      hotkey="n"
      label="New transaction"
    >
      <SheetHeader>
        <SheetTitle>New transaction</SheetTitle>
      </SheetHeader>
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
              <InputGroupButton
                size="icon-xs"
                aria-pressed={negative}
                aria-label={
                  negative ? 'Make amount positive' : 'Make amount negative'
                }
                onClick={() => setNegative((v) => !v)}
              >
                {negative ? <Minus /> : <Plus />}
              </InputGroupButton>
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="txn-amount"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/-/g, ''))}
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
          </FieldLabel>
          <TimePicker
            id="txn-created-at"
            value={createdAt}
            onChange={setCreatedAt}
          />
          {selectedAccount && selectedAccount.timezone != CLIENT_TIMEZONE && (
            <FieldDescription>
              {`= ${formatZonedDateTime(createdAt, selectedAccount.timezone)} in ${selectedAccount.timezone}`}
            </FieldDescription>
          )}
        </Field>
      </FabForm>
    </FabSheet>
  )
}
