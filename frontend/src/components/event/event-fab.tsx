import { EventForm } from '@/components/event-form'
import { FabSheet } from '@/components/fab-sheet'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventEntryCreate,
  type EventReadDetailed
} from '@/lib/client'
import type { Client } from '@/lib/client/client'

type EventEntryPayload = Omit<EventEntryCreate, 'event_id'>

interface EventFabProps {
  client: Client
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEvent: EventReadDetailed | null
  onSubmit: (
    body: EventCreate,
    linkedTransactionIds: number[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
}

export function EventFab({
  client,
  accounts,
  categories,
  currencies,
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
      className="data-[side=right]:sm:max-w-2xl"
    >
      <SheetHeader>
        <SheetTitle>{editingEvent ? 'Edit event' : 'New event'}</SheetTitle>
      </SheetHeader>
      {/* Keyed so the form re-initializes from the picked event. */}
      <EventForm
        key={editingEvent?.id ?? 'new'}
        client={client}
        accounts={accounts}
        categories={categories}
        currencies={currencies}
        editingEvent={editingEvent}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
