import { useState } from 'react'

import { FabSheet } from '@/components/fab-sheet'
import { TransactionForm } from '@/components/transaction-form'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  type AccountRead,
  type CategoryReadWithChildren,
  type CurrencyRead,
  type EventCreate,
  type EventEntryCreate,
  type EventRead,
  type EventReadDetailed,
  type TransactionCreate,
  type TransactionRead
} from '@/lib/client'
import type { Client } from '@/lib/client/client'

type EventEntryPayload = Omit<EventEntryCreate, 'event_id'>

interface TransactionFabProps {
  client: Client
  accounts: AccountRead[]
  account?: AccountRead
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  events: EventReadDetailed[] | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransaction: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  onCreateEvent: (
    body: EventCreate,
    linkedTransactionIds: number[],
    entries: EventEntryPayload[]
  ) => Promise<EventRead>
  isPending: boolean
  isCreatingEvent: boolean
}

export function TransactionFab({
  client,
  accounts,
  account,
  categories,
  currencies,
  events,
  open,
  onOpenChange,
  editingTransaction,
  onSubmit,
  onCreateEvent,
  isPending,
  isCreatingEvent
}: TransactionFabProps) {
  const [eventSheetOpen, setEventSheetOpen] = useState(false)

  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New transaction"
      // While the nested event sheet is open, an outside pointer-down would
      // otherwise dismiss both non-modal sheets at once. Ignore it here so only
      // the top (event) sheet closes, matching the Escape-key behavior.
      onInteractOutside={(e) => {
        if (eventSheetOpen) e.preventDefault()
      }}
    >
      <SheetHeader>
        <SheetTitle>
          {editingTransaction ? 'Edit transaction' : 'New transaction'}
        </SheetTitle>
      </SheetHeader>
      {/* Keyed so the form re-initializes from the picked transaction. */}
      <TransactionForm
        key={editingTransaction?.id ?? 'new'}
        client={client}
        accounts={accounts}
        account={account}
        categories={categories}
        currencies={currencies}
        events={events}
        editingTransaction={editingTransaction}
        onSubmit={onSubmit}
        onCreateEvent={onCreateEvent}
        isPending={isPending}
        isCreatingEvent={isCreatingEvent}
        eventSheetOpen={eventSheetOpen}
        onEventSheetOpenChange={setEventSheetOpen}
      />
    </FabSheet>
  )
}
