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
  seedTransaction?: TransactionRead | null
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
  seedTransaction,
  onSubmit,
  isPending
}: TransactionFabProps) {
  const title = editingTransaction
    ? 'Edit transaction'
    : seedTransaction
      ? 'Duplicate transaction'
      : 'New transaction'
  const formKey = editingTransaction
    ? `edit-${editingTransaction.id}`
    : seedTransaction
      ? `duplicate-${seedTransaction.id}`
      : 'new'

  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New transaction"
      title={title}
    >
      {/* Keyed so the form re-initializes from the picked transaction. */}
      <TransactionForm
        key={formKey}
        accounts={accounts}
        account={account}
        currencies={currencies}
        transactionTags={transactionTags}
        events={events}
        editingTransaction={editingTransaction}
        seedTransaction={seedTransaction}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
