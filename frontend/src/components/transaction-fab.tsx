import { Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  type TransactionRead
} from '@/lib/client'
import { CLIENT_TIMEZONE } from '@/lib/constants'
import { formatZonedDateTime, toZonedISOString } from '@/lib/utils'

interface TransactionFabProps {
  accounts: AccountRead[]
  account?: AccountRead
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransaction: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  isPending: boolean
}

interface TransactionFabBodyProps {
  accounts: AccountRead[]
  account?: AccountRead
  editingTransaction: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  isPending: boolean
}

export function TransactionFab({
  accounts,
  account,
  open,
  onOpenChange,
  editingTransaction,
  onSubmit,
  isPending
}: TransactionFabProps) {
  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New transaction"
    >
      <SheetHeader>
        <SheetTitle>
          {editingTransaction ? 'Edit transaction' : 'New transaction'}
        </SheetTitle>
      </SheetHeader>
      {/* Keyed so the form re-initializes from the picked transaction. */}
      <TransactionFabBody
        key={editingTransaction?.id ?? 'new'}
        accounts={accounts}
        account={account}
        editingTransaction={editingTransaction}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}

function TransactionFabBody({
  accounts,
  account,
  editingTransaction,
  onSubmit,
  isPending
}: TransactionFabBodyProps) {
  const isEditing = editingTransaction != null
  const [amount, setAmount] = useState(() =>
    isEditing ? Math.abs(parseFloat(editingTransaction.amount)).toString() : ''
  )
  const [negative, setNegative] = useState(() =>
    isEditing ? parseFloat(editingTransaction.amount) < 0 : false
  )
  const [pickedAccount, setPickedAccount] = useState<AccountRead | null>(null)
  const [createdAt, setCreatedAt] = useState(() =>
    isEditing ? new Date(editingTransaction.created_at) : new Date()
  )

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null

  const zonedCreatedAt = useMemo(
    () =>
      selectedAccount
        ? toZonedISOString(createdAt, selectedAccount.timezone)
        : null,
    [createdAt, selectedAccount]
  )

  const handleSubmit = () => {
    if (selectedAccount == null || zonedCreatedAt == null) return
    onSubmit({
      account_id: selectedAccount.id,
      amount: negative ? `-${amount}` : amount,
      created_at: zonedCreatedAt
    })
  }

  return (
    <FabForm
      onSubmit={handleSubmit}
      isPending={isPending}
      disabled={selectedAccount == null || amount === ''}
      isEditing={isEditing}
    >
      <Field>
        <FieldLabel htmlFor="txn-account">Account</FieldLabel>
        <AccountSelect
          id="txn-account"
          accounts={accounts}
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
  )
}
