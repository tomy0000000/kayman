import {
  ArrowLeftRight,
  type LucideIcon,
  Repeat,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'

import { EventEntriesField } from '@/components/event/event-entries-field'
import { KbdForm } from '@/components/kbd-form'
import { type SelectedTransaction } from '@/components/link-transactions-table'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { TransactionsField } from '@/components/transaction/transactions-field'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ZonedTimePicker } from '@/components/zoned-time-picker'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventEntryCreate,
  type EventReadDetailed,
  type EventType
} from '@/lib/client'
import { CLIENT_TIMEZONE } from '@/lib/constants'
import { eventTypeTabActiveClass } from '@/lib/event-types'
import {
  type EventEntryDraft,
  type TransactionDraft,
  type TransactionPayload,
  toEventEntryDraft,
  toTransactionDraft
} from '@/lib/types'
import { cn, toZonedISOString } from '@/lib/utils'

const EVENT_TYPES: { value: EventType; icon: LucideIcon }[] = [
  { value: 'Expense', icon: TrendingDown },
  { value: 'Income', icon: TrendingUp },
  { value: 'Transfer', icon: ArrowLeftRight },
  { value: 'Exchange', icon: Repeat }
]

type EventEntryPayload = Omit<EventEntryCreate, 'event_id'>

interface EventFormProps {
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  editingEvent: EventReadDetailed | null
  // Seeds a new event from a transaction: prefills the timestamp, zone, and
  // linked transaction. Ignored when editing an existing event.
  seedTransaction?: SelectedTransaction
  onSubmit: (
    body: EventCreate,
    transactions: TransactionPayload[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
}

export function EventForm({
  accounts,
  categories,
  currencies,
  editingEvent,
  seedTransaction,
  onSubmit,
  isPending
}: EventFormProps) {
  const isEditing = editingEvent != null
  const [type, setType] = useState<EventType>(editingEvent?.type ?? 'Expense')
  const [description, setDescription] = useState(
    editingEvent?.description ?? ''
  )
  const [timezone, setTimezone] = useState<string>(
    editingEvent?.timezone ??
      seedTransaction?.account.timezone ??
      CLIENT_TIMEZONE
  )
  const [timestamp, setTimestamp] = useState(() => {
    if (isEditing) return editingEvent.timestamp
    if (seedTransaction) return seedTransaction.transaction.created_at
    return toZonedISOString(new Date(), CLIENT_TIMEZONE)
  })
  const [transactions, setTransactions] = useState<TransactionDraft[]>(() => {
    if (isEditing) return editingEvent.transactions.map(toTransactionDraft)
    return seedTransaction
      ? [toTransactionDraft(seedTransaction.transaction)]
      : []
  })
  const [entries, setEntries] = useState<EventEntryDraft[]>(() =>
    isEditing ? editingEvent.entries.map(toEventEntryDraft) : []
  )

  // The API can only batch-create entries, so an existing event's entries are
  // shown but not editable.
  const incompleteEntry = entries.some(
    (entry) =>
      entry.categoryId == null ||
      entry.currencyCode == null ||
      entry.amount === ''
  )

  const incompleteTransaction = transactions.some(
    (transaction) => transaction.accountId == null || transaction.amount === ''
  )

  const handleSubmit = () => {
    const body: EventCreate = {
      type,
      timestamp,
      timezone: timezone as EventCreate['timezone'],
      description: description.trim() || null
    }
    onSubmit(
      body,
      transactions.map((transaction, index) => ({
        id: transaction.id,
        account_id: transaction.accountId as number,
        amount: transaction.amount,
        index
      })),
      entries.map((entry, index) => ({
        category_id: entry.categoryId as number,
        amount: entry.amount,
        quantity: parseInt(entry.quantity, 10),
        currency_code: entry.currencyCode as string,
        description: entry.description.trim() || null,
        index
      }))
    )
  }

  return (
    <KbdForm
      onSubmit={handleSubmit}
      isPending={isPending}
      disabled={incompleteEntry || incompleteTransaction}
      isEditing={isEditing}
    >
      <Field>
        <FieldLabel>Type</FieldLabel>
        <Tabs
          value={type}
          onValueChange={(value) => setType(value as EventType)}
        >
          <TabsList className="w-full">
            {EVENT_TYPES.map(({ value, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  'gap-1 px-1 text-xs',
                  eventTypeTabActiveClass[value]
                )}
              >
                <Icon />
                {value}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Field>

      <Field>
        <FieldLabel>Transactions</FieldLabel>
        <TransactionsField
          accounts={accounts}
          value={transactions}
          onChange={setTransactions}
        />
      </Field>

      <Field>
        <FieldLabel>Entries</FieldLabel>
        <EventEntriesField
          categories={categories}
          currencies={currencies}
          value={entries}
          onChange={setEntries}
          readOnly={isEditing}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="event-timezone">Timezone</FieldLabel>
        <TimezoneCombobox
          id="event-timezone"
          value={timezone}
          onValueChange={setTimezone}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="event-timestamp">Timestamp</FieldLabel>
        <ZonedTimePicker
          id="event-timestamp"
          value={new Date(timestamp)}
          timezone={timezone}
          onChange={setTimestamp}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="event-description">Description</FieldLabel>
        <Input
          id="event-description"
          placeholder="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </KbdForm>
  )
}
