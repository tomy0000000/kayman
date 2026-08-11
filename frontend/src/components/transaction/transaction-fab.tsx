import { FabSheet } from '@/components/fab-sheet'
import { TransactionForm } from '@/components/transaction/transaction-form'
import {
  type AccountRead,
  type CurrencyRead,
  type EventReadDetailed,
  type TransactionCreate,
  type TransactionRead,
  type TransactionTagRead
} from '@/lib/client'

interface TransactionFabProps {
  accounts: AccountRead[]
  account?: AccountRead
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
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
  currencies,
  transactionTags,
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
      title={editingTransaction ? 'Edit transaction' : 'New transaction'}
    >
      {/* Keyed so the form re-initializes from the picked transaction. */}
      <TransactionForm
        key={editingTransaction?.id ?? 'new'}
        accounts={accounts}
        account={account}
        currencies={currencies}
        transactionTags={transactionTags}
        events={events}
        editingTransaction={editingTransaction}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
