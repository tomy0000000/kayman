import { useState } from 'react'

import { AccountSelect } from '@/components/account-select'
import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { KbdForm } from '@/components/kbd-form'
import { LinkEventField } from '@/components/link-event-field'
import { Field, FieldLabel } from '@/components/ui/field'
import { ZonedTimePicker } from '@/components/zoned-time-picker'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type AccountRead,
  type CurrencyRead,
  type EventReadDetailed,
  type TransactionCreate,
  type TransactionRead
} from '@/lib/client'
import { isAmount, toZonedISOString } from '@/lib/utils'

interface TransactionFormProps {
  accounts: AccountRead[]
  account?: AccountRead
  currencies: CurrencyRead[]
  events: EventReadDetailed[] | undefined
  editingTransaction: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  isPending: boolean
}

export function TransactionForm({
  accounts,
  account,
  currencies,
  events,
  editingTransaction,
  onSubmit,
  isPending
}: TransactionFormProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const isEditing = editingTransaction != null
  const [amount, setAmount] = useState(() =>
    isEditing ? editingTransaction.amount : ''
  )
  const [pickedAccount, setPickedAccount] = useState<AccountRead | null>(null)
  const [createdAt, setCreatedAt] = useState(() =>
    isEditing
      ? editingTransaction.created_at
      : toZonedISOString(new Date(), clientTimezone)
  )
  const [eventId, setEventId] = useState<number | null>(
    editingTransaction?.event_id ?? null
  )

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null
  const currency = currencies.find(
    (c) => c.code === selectedAccount?.currency_code
  )

  const handleSubmit = () => {
    if (selectedAccount == null) return
    onSubmit({
      account_id: selectedAccount.id,
      amount,
      created_at: createdAt,
      event_id: eventId
    })
  }

  return (
    <KbdForm
      onSubmit={handleSubmit}
      isPending={isPending}
      disabled={selectedAccount == null || !isAmount(amount)}
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
        <CurrencyAmountInput
          id="txn-amount"
          amount={amount}
          onAmountChange={setAmount}
          currency={currency}
          required
        />
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
          timezone={selectedAccount?.timezone ?? clientTimezone}
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
    </KbdForm>
  )
}
