import { EventForm } from '@/components/event/event-form'
import { FabSheet } from '@/components/fab-sheet'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventReadDetailed,
  type TransactionTagRead
} from '@/lib/client'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'

interface EventFabProps {
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEvent: EventReadDetailed | null
  onSubmit: (
    body: EventCreate,
    transactions: TransactionPayload[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
}

export function EventFab({
  accounts,
  categories,
  currencies,
  transactionTags,
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
      title={editingEvent ? 'Edit event' : 'New event'}
      className="data-[side=right]:sm:max-w-2xl"
    >
      {/* Keyed so the form re-initializes from the picked event. */}
      <EventForm
        key={editingEvent?.id ?? 'new'}
        accounts={accounts}
        categories={categories}
        currencies={currencies}
        transactionTags={transactionTags}
        editingEvent={editingEvent}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
