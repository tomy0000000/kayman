import { EventForm } from '@/components/event/event-form'
import { EventReceipt } from '@/components/event/event-receipt'
import { ResponsiveSheet } from '@/components/responsive-sheet'
import {
  type AccountRead,
  type CategoryRead,
  type CurrencyRead,
  type EventCreate,
  type EventReadDetailed,
  type TransactionTagRead
} from '@/lib/client'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'

// What the sheet is showing. One slot rather than a flag per mode, so the
// modes cannot disagree.
export type EventSheetState =
  | { mode: 'new' }
  | { mode: 'edit'; event: EventReadDetailed }
  | { mode: 'duplicate'; event: EventReadDetailed }
  | { mode: 'view'; event: EventReadDetailed }

interface EventSheetProps {
  open: boolean
  // Kept while closing, so the body does not vanish mid animation.
  state: EventSheetState
  onOpenChange: (open: boolean) => void
  accounts: AccountRead[]
  categories: CategoryRead[]
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
  // Calendar day to default a new event's timestamp to. See EventForm.
  seedDate?: Date
  onSubmit: (
    body: EventCreate,
    transactions: TransactionPayload[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
}

const TITLES: Record<EventSheetState['mode'], string> = {
  new: 'New event',
  edit: 'Edit event',
  duplicate: 'Duplicate event',
  view: 'Event details'
}

export function EventSheet({
  open,
  state,
  onOpenChange,
  accounts,
  categories,
  currencies,
  transactionTags,
  seedDate,
  onSubmit,
  isPending
}: EventSheetProps) {
  // Qualified by mode, so editing then duplicating the same event still remounts.
  const formKey =
    state.mode === 'new' ? 'new' : `${state.mode}-${state.event.id}`

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={TITLES[state.mode]}
      className="data-[side=right]:sm:max-w-2xl"
    >
      {state.mode === 'view' ? (
        <EventReceipt
          event={state.event}
          categories={categories}
          accounts={accounts}
        />
      ) : (
        /* Keyed so the form re-initializes from the picked event. */
        <EventForm
          key={formKey}
          accounts={accounts}
          categories={categories}
          currencies={currencies}
          transactionTags={transactionTags}
          editingEvent={state.mode === 'edit' ? state.event : null}
          seedEvent={state.mode === 'duplicate' ? state.event : null}
          seedDate={seedDate}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </ResponsiveSheet>
  )
}
