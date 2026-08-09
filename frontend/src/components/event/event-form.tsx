import {
  ArrowLeftRight,
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ZonedTimePicker } from '@/components/zoned-time-picker'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventReadDetailed,
  type EventType,
  type TransactionTagRead
} from '@/lib/client'
import { eventTypeTabActiveClass } from '@/lib/event-types'
import {
  type EventEntryDraft,
  type EventEntryPayload,
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

interface EventFormProps {
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
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
  transactionTags,
  editingEvent,
  seedTransaction,
  onSubmit,
  isPending
}: EventFormProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const isEditing = editingEvent != null
  const [type, setType] = useState<EventType>(editingEvent?.type ?? 'Expense')
  const [description, setDescription] = useState(
    editingEvent?.description ?? ''
  )
  const [timezone, setTimezone] = useState<string>(
    editingEvent?.timezone ??
      seedTransaction?.account.timezone ??
      clientTimezone
  )
  const [timestamp, setTimestamp] = useState(() => {
    if (isEditing) return editingEvent.timestamp
    if (seedTransaction) return seedTransaction.transaction.created_at
    return toZonedISOString(new Date(), clientTimezone)
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
        tag_ids: transaction.tagIds,
        index
      })),
      entries.map((entry, index) => ({
        id: entry.id,
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
          currencies={currencies}
          transactionTags={transactionTags}
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

      <Collapsible className="space-y-5">
        <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Advanced
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5">
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
            <FieldLabel htmlFor="event-timezone">Timezone</FieldLabel>
            <TimezoneCombobox
              id="event-timezone"
              value={timezone}
              onValueChange={setTimezone}
            />
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </KbdForm>
  )
}
