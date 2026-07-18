import { FabSheet } from '@/components/fab-sheet'
import { TransactionForm } from '@/components/transaction-form'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  type AccountRead,
  type EventReadDetailed,
  type TransactionCreate,
  type TransactionRead
} from '@/lib/client'

interface TransactionFabProps {
  accounts: AccountRead[]
  account?: AccountRead
  events: EventReadDetailed[] | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransaction: TransactionRead | null
  onSubmit: (body: TransactionCreate) => void
  isPending: boolean
}

export function TransactionFab({
  accounts,
  account,
  events,
  open,
  onOpenChange,
  editingTransaction,
  onSubmit,
  isPending
}: TransactionFabProps) {
  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New transaction"
    >
      <SheetHeader>
        <SheetTitle>
          {editingTransaction ? 'Edit transaction' : 'New transaction'}
        </SheetTitle>
      </SheetHeader>
      {/* Keyed so the form re-initializes from the picked transaction. */}
      <TransactionForm
        key={editingTransaction?.id ?? 'new'}
        accounts={accounts}
        account={account}
        events={events}
        editingTransaction={editingTransaction}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
