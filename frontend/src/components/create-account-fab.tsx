import { CreateAccountForm } from '@/components/create-account-form'
import { FabSheet } from '@/components/fab-sheet'
import { type AccountCreate, type CurrencyRead } from '@/lib/client'

interface CreateAccountFabProps {
  currencies: CurrencyRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: AccountCreate) => void
  isPending: boolean
}

export function CreateAccountFab({
  currencies,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: CreateAccountFabProps) {
  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New account"
      title="New account"
    >
      <CreateAccountForm
        currencies={currencies}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
