import {
  ArrowLeftRight,
  type LucideIcon,
  Repeat,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'

import { EventEntriesField } from '@/components/event-entries-field'
import { FabForm } from '@/components/fab-form'
import { type SelectedTransaction } from '@/components/link-transactions-table'
import { LinkedTransactionsField } from '@/components/linked-transactions-field'
import { TimePicker } from '@/components/time-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventEntryCreate,
  type EventReadDetailed,
  type EventType
} from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { CLIENT_TIMEZONE } from '@/lib/constants'
import { eventTypeTabActiveClass } from '@/lib/event-types'
import { type EventEntryDraft, toEventEntryDraft } from '@/lib/types'
import {
  cn,
  formatZonedDateTime,
  toLocalDateTimeInputValue,
  toZonedISOString
} from '@/lib/utils'

const EVENT_TYPES: { value: EventType; icon: LucideIcon }[] = [
  { value: 'Expense', icon: TrendingDown },
  { value: 'Income', icon: TrendingUp },
  { value: 'Transfer', icon: ArrowLeftRight },
  { value: 'Exchange', icon: Repeat }
]

type EventEntryPayload = Omit<EventEntryCreate, 'event_id'>

interface EventFormProps {
  client: Client
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  editingEvent: EventReadDetailed | null
  onSubmit: (
    body: EventCreate,
    linkedTransactionIds: number[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
  hideTransactions?: boolean
}

export function EventForm({
  client,
  accounts,
  categories,
  currencies,
  editingEvent,
  onSubmit,
  isPending,
  hideTransactions = false
}: EventFormProps) {
  const isEditing = editingEvent != null
  const [type, setType] = useState<EventType>(editingEvent?.type ?? 'Expense')
  const [description, setDescription] = useState(
    editingEvent?.description ?? ''
  )
  const [timestamp, setTimestamp] = useState(() =>
    isEditing ? new Date(editingEvent.timestamp) : new Date()
  )
  const [linkedTransactions, setLinkedTransactions] = useState<
    SelectedTransaction[]
  >(() => {
    if (!isEditing) return []
    const accountsById = new Map(
      accounts.map((account) => [account.id, account])
    )
    return editingEvent.transactions.flatMap((transaction) => {
      const account = accountsById.get(transaction.account_id)
      return account ? [{ transaction, account }] : []
    })
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

  const handleSubmit = () => {
    const body: EventCreate = isEditing
      ? {
          type,
          timestamp: toZonedISOString(timestamp, editingEvent.timezone),
          timezone: editingEvent.timezone,
          description: description.trim() || null
        }
      : {
          type,
          timestamp: toLocalDateTimeInputValue(timestamp),
          timezone: CLIENT_TIMEZONE as EventCreate['timezone'],
          description: description.trim() || null
        }
    onSubmit(
      body,
      linkedTransactions.map((item) => item.transaction.id),
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
    <FabForm
      onSubmit={handleSubmit}
      isPending={isPending}
      disabled={incompleteEntry}
      isEditing={isEditing}
    >
      <Field>
        <FieldLabel htmlFor="event-description">Description</FieldLabel>
        <Input
          id="event-description"
          placeholder="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

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
        <FieldLabel htmlFor="event-timestamp">Timestamp</FieldLabel>
        <TimePicker
          id="event-timestamp"
          value={timestamp}
          onChange={setTimestamp}
        />
        {isEditing && editingEvent.timezone != CLIENT_TIMEZONE && (
          <FieldDescription>
            {`= ${formatZonedDateTime(timestamp, editingEvent.timezone)} in ${editingEvent.timezone}`}
          </FieldDescription>
        )}
      </Field>

      {!hideTransactions && (
        <Field>
          <FieldLabel>Transactions</FieldLabel>
          <LinkedTransactionsField
            client={client}
            value={linkedTransactions}
            onChange={setLinkedTransactions}
          />
        </Field>
      )}

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
    </FabForm>
  )
}
