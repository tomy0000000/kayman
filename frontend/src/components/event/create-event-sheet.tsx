import { EventForm } from '@/components/event/event-form'
import { ResponsiveSheet } from '@/components/responsive-sheet'
import {
  type AccountRead,
  type CategoryRead,
  type CurrencyRead,
  type EventCreate,
  type TransactionReadWithBalance,
  type TransactionTagRead
} from '@/lib/client'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'

interface CreateEventSheetProps {
  transaction: TransactionReadWithBalance | null
  account?: AccountRead
  accounts: AccountRead[]
  categories: CategoryRead[]
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
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
  transactionTags,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: CreateEventSheetProps) {
  const seedTransaction =
    transaction && account ? { transaction, account } : undefined

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New event"
      className="data-[side=right]:sm:max-w-2xl"
    >
      {/* Keyed so the form re-initializes from the picked transaction. */}
      <EventForm
        key={transaction?.id ?? 'new'}
        accounts={accounts}
        categories={categories}
        currencies={currencies}
        transactionTags={transactionTags}
        editingEvent={null}
        seedTransaction={seedTransaction}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </ResponsiveSheet>
  )
}
