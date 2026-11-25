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
  type TransactionRead,
  type TransactionTagRead
} from '@/lib/client'
import { type EventLinkDraft, type TransactionSubmit } from '@/lib/types'
import { isAmount, nextLinkIndex, toZonedISOString } from '@/lib/utils'

interface TransactionFormProps {
  accounts: AccountRead[]
  account?: AccountRead
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
  events: EventReadDetailed[] | undefined
  editingTransaction: TransactionRead | null
  seedTransaction?: TransactionRead | null
  onSubmit: (submit: TransactionSubmit) => void
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
  // A cleared transaction's events are cleared too, so its duplicate can't join them.
  const [links, setLinks] = useState<EventLinkDraft[]>(() =>
    seedTransaction?.cleared_at
      ? []
      : (source?.event_links ?? []).map(({ id, event, amount }) => ({
          id: isEditing ? id : null,
          event,
          amount
        }))
  )
  const [tagIds, setTagIds] = useState<number[]>(
    () => source?.tags?.map((tag) => tag.id) ?? []
  )

  // A user pick wins; otherwise fall back to the account passed in.
  const selectedAccount = pickedAccount ?? account ?? null
  const currency = currencies.find(
    (c) => c.code === selectedAccount?.currency_code
  )

  const isSplit = links.length > 1

  const handleSubmit = () => {
    if (selectedAccount == null) return
    onSubmit({
      body: {
        account_id: selectedAccount.id,
        amount,
        created_at: createdAt,
        tag_ids: tagIds
      },
      links: links.map((link) => {
        const event = events?.find(({ id }) => id === link.event.id)
        return {
          id: link.id,
          event_id: link.event.id,
          // A single link takes the whole amount, a split link its own share
          amount: isSplit ? link.amount : amount,
          index: link.id == null && event ? nextLinkIndex(event) : null
        }
      })
    })
  }

  return (
    <KbdForm
      onSubmit={handleSubmit}
      isPending={isPending}
      disabled={
        selectedAccount == null ||
        !isAmount(amount) ||
        (isSplit && links.some((link) => !isAmount(link.amount))) ||
        // A new link's position comes from its event in the list
        links.some(
          (link) =>
            link.id == null && !events?.some(({ id }) => id === link.event.id)
        )
      }
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
        <FieldLabel>Events</FieldLabel>
        <LinkEventField
          events={events}
          links={links}
          amount={amount}
          currency={currency}
          onChange={setLinks}
        />
      </Field>
    </KbdForm>
  )
}
