import { EventForm } from '@/components/event-form'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventEntryCreate
} from '@/lib/client'
import type { Client } from '@/lib/client/client'

type EventEntryPayload = Omit<EventEntryCreate, 'event_id'>

interface EventSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  onSubmit: (
    body: EventCreate,
    linkedTransactionIds: number[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
  defaultTimestamp?: string
}

// A trigger-less, create-only event sheet meant to stack over another sheet
// (e.g. the transaction FAB). Unlike EventFab it does not use FabSheet, so it
// carries no floating button and no "n" hotkey to conflict with the host.
export function EventSheet({
  open,
  onOpenChange,
  client,
  accounts,
  categories,
  currencies,
  onSubmit,
  isPending,
  defaultTimestamp
}: EventSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="flex flex-col data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>New event</SheetTitle>
        </SheetHeader>
        {/* Keyed so the form re-initializes its timestamp default whenever the
            host's timestamp changes. */}
        <EventForm
          key={defaultTimestamp}
          client={client}
          accounts={accounts}
          categories={categories}
          currencies={currencies}
          editingEvent={null}
          onSubmit={onSubmit}
          isPending={isPending}
          hideTransactions
          defaultTimestamp={defaultTimestamp}
        />
      </SheetContent>
    </Sheet>
  )
}
