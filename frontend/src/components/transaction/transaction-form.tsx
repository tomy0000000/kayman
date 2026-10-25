import { useState } from 'react'

import { AccountSelect } from '@/components/account/account-select'
import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { KbdForm } from '@/components/kbd-form'
import { LinkEventField } from '@/components/link-event-field'
import { TransactionTagsPopover } from '@/components/transaction/transaction-tags-popover'
import { Field, FieldLabel } from '@/components/ui/field'
import { ZonedTimePicker } from '@/components/zoned-time-picker'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type AccountRead,
  type CurrencyRead,
  type EventReadDetailed,
  type TransactionCreate,
  type TransactionRead,
  type TransactionTagRead
} from '@/lib/client'
import { isAmount, nextTransactionIndex, toZonedISOString } from '@/lib/utils'

interface TransactionFormProps {
  accounts: AccountRead[]
  account?: AccountRead
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
  events: EventReadDetailed[] | undefined
  editingTransaction: TransactionRead | null
  seedTransaction?: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  isPending: boolean
}

export function TransactionForm({
  accounts,
  account,
  currencies,
  transactionTags,
  events,
  editingTransaction,
  seedTransaction,
  onSubmit,
  isPending
}: TransactionFormProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const isEditing = editingTransaction != null
  const source = editingTransaction ?? seedTransaction
  const [amount, setAmount] = useState(() => source?.amount ?? '')
  const [pickedAccount, setPickedAccount] = useState<AccountRead | null>(null)
  const [createdAt, setCreatedAt] = useState(() =>
    isEditing
      ? editingTransaction.created_at
      : toZonedISOString(new Date(), clientTimezone)
  )
  // A cleared transaction's event is cleared too, so its duplicate can't join it.
  const [eventId, setEventId] = useState<number | null>(
    seedTransaction?.cleared_at ? null : (source?.event_id ?? null)
  )
  const [tagIds, setTagIds] = useState<number[]>(
    () => source?.tags?.map((tag) => tag.id) ?? []
  )

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null
  const currency = currencies.find(
    (c) => c.code === selectedAccount?.currency_code
  )

  // (event_id, index) is unique in the DB, so linking to an event must claim a
  // free slot and unlinking must clear it. Staying on the same event keeps the
  // row's current index, so `index` is left unset.
  const indexPatch = (): Pick<TransactionCreate, 'index'> => {
    if (eventId == null) return { index: null }
    if (editingTransaction?.event_id === eventId) return {}
    const event = events?.find((e) => e.id === eventId)
    if (event == null) return {}
    return {
      index: nextTransactionIndex(event.transactions, editingTransaction?.id)
    }
  }

  const handleSubmit = () => {
    if (selectedAccount == null) return
    onSubmit({
      account_id: selectedAccount.id,
      amount,
      created_at: createdAt,
      event_id: eventId,
      tag_ids: tagIds,
      ...indexPatch()
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
        <div className="flex items-center gap-1">
          <CurrencyAmountInput
            id="txn-amount"
            amount={amount}
            onAmountChange={setAmount}
            currency={currency}
            required
          />
          <TransactionTagsPopover
            tags={transactionTags}
            value={tagIds}
            onValueChange={setTagIds}
          />
        </div>
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
