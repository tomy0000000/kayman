import { EventForm } from '@/components/event/event-form'
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
  type TransactionReadWithBalance
} from '@/lib/client'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'

interface CreateEventSheetProps {
  transaction: TransactionReadWithBalance | null
  account?: AccountRead
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    body: EventCreate,
    transactions: TransactionPayload[],
    entries: EventEntryPayload[]
  ) => void
  isPending: boolean
}

export function CreateEventSheet({
  transaction,
  account,
  accounts,
  categories,
  currencies,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: CreateEventSheetProps) {
  const seedTransaction =
    transaction && account ? { transaction, account } : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="flex flex-col data-[side=right]:sm:max-w-2xl"
        onFocusOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>New event</SheetTitle>
        </SheetHeader>
        {/* Keyed so the form re-initializes from the picked transaction. */}
        <EventForm
          key={transaction?.id ?? 'new'}
          accounts={accounts}
          categories={categories}
          currencies={currencies}
          editingEvent={null}
          seedTransaction={seedTransaction}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </SheetContent>
    </Sheet>
  )
}
