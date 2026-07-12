import {
  ArrowLeftRight,
  type LucideIcon,
  Repeat,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'

import { FabForm } from '@/components/fab-form'
import { FabSheet } from '@/components/fab-sheet'
import { type SelectedTransaction } from '@/components/link-transactions-table'
import { LinkedTransactionsField } from '@/components/linked-transactions-field'
import { TimePicker } from '@/components/time-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type AccountRead,
  type EventCreate,
  type EventReadDetailed,
  type EventType
} from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { CLIENT_TIMEZONE } from '@/lib/constants'
import { eventTypeTabActiveClass } from '@/lib/event-types'
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

interface EventFabProps {
  client: Client
  accounts: AccountRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEvent: EventReadDetailed | null
  onSubmit: (body: EventCreate, linkedTransactionIds: number[]) => void
  isPending: boolean
}

interface EventFabBodyProps {
  client: Client
  accounts: AccountRead[]
  editingEvent: EventReadDetailed | null
  onSubmit: (body: EventCreate, linkedTransactionIds: number[]) => void
  isPending: boolean
}

export function EventFab({
  client,
  accounts,
  open,
  onOpenChange,
  editingEvent,
  onSubmit,
  isPending
}: EventFabProps) {
  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New event"
    >
      <SheetHeader>
        <SheetTitle>{editingEvent ? 'Edit event' : 'New event'}</SheetTitle>
      </SheetHeader>
      {/* Keyed so the form re-initializes from the picked event. */}
      <EventFabBody
        key={editingEvent?.id ?? 'new'}
        client={client}
        accounts={accounts}
        editingEvent={editingEvent}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}

function EventFabBody({
  client,
  accounts,
  editingEvent,
  onSubmit,
  isPending
}: EventFabBodyProps) {
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
      linkedTransactions.map((item) => item.transaction.id)
    )
  }

  return (
    <FabForm
      onSubmit={handleSubmit}
      isPending={isPending}
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

      <Field>
        <FieldLabel>Transactions</FieldLabel>
        <LinkedTransactionsField
          client={client}
          value={linkedTransactions}
          onChange={setLinkedTransactions}
        />
      </Field>
    </FabForm>
  )
}
