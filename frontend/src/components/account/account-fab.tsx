import { AccountForm } from '@/components/account/account-form'
import { FabSheet } from '@/components/fab-sheet'
import {
  type AccountCreate,
  type AccountRead,
  type CurrencyRead
} from '@/lib/client'

interface AccountFabProps {
  currencies: CurrencyRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  editingAccount: AccountRead | null
  onSubmit: (body: AccountCreate) => void
  isPending: boolean
}

export function AccountFab({
  currencies,
  open,
  onOpenChange,
  editingAccount,
  onSubmit,
  isPending
}: AccountFabProps) {
  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New account"
      title={editingAccount ? 'Edit account' : 'New account'}
    >
      {/* Keyed so the form re-initializes from the picked account. */}
      <AccountForm
        key={editingAccount ? `edit-${editingAccount.id}` : 'new'}
        currencies={currencies}
        editingAccount={editingAccount}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
