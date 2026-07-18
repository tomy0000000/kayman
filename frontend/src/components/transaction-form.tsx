import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { AccountSelect } from '@/components/account-select'
import { FabForm } from '@/components/fab-form'
import { LinkEventField } from '@/components/link-event-field'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { ZonedTimePicker } from '@/components/zoned-time-picker'
import {
  type AccountRead,
  type EventReadDetailed,
  type TransactionCreate,
  type TransactionRead
} from '@/lib/client'
import { CLIENT_TIMEZONE } from '@/lib/constants'
import { toZonedISOString } from '@/lib/utils'

interface TransactionFormProps {
  accounts: AccountRead[]
  account?: AccountRead
  events: EventReadDetailed[] | undefined
  editingTransaction: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  isPending: boolean
}

export function TransactionForm({
  accounts,
  account,
  events,
  editingTransaction,
  onSubmit,
  isPending
}: TransactionFormProps) {
  const isEditing = editingTransaction != null
  const [amount, setAmount] = useState(() =>
    isEditing ? Math.abs(parseFloat(editingTransaction.amount)).toString() : ''
  )
  const [negative, setNegative] = useState(() =>
    isEditing ? parseFloat(editingTransaction.amount) < 0 : false
  )
  const [pickedAccount, setPickedAccount] = useState<AccountRead | null>(null)
  const [createdAt, setCreatedAt] = useState(() =>
    isEditing
      ? editingTransaction.created_at
      : toZonedISOString(new Date(), CLIENT_TIMEZONE)
  )
  const [eventId, setEventId] = useState<number | null>(
    editingTransaction?.event_id ?? null
  )

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null

  const handleSubmit = () => {
    if (selectedAccount == null) return
    onSubmit({
      account_id: selectedAccount.id,
      amount: negative ? `-${amount}` : amount,
      created_at: createdAt,
      event_id: eventId
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
        <ZonedTimePicker
          id="txn-created-at"
          value={new Date(createdAt)}
          timezone={selectedAccount?.timezone ?? CLIENT_TIMEZONE}
          onChange={setCreatedAt}
        />
      </Field>

      <Field>
        <FieldLabel>Event</FieldLabel>
        <LinkEventField
          events={events}
          eventId={eventId}
          onChange={setEventId}
        />
      </Field>
    </FabForm>
  )
}
