import { FabSheet } from '@/components/fab-sheet'
import { CreateStatementForm } from '@/components/statement/create-statement-form'
import {
  type AccountType,
  type CurrencyRead,
  type StatementCreate,
  type StatementRead
} from '@/lib/client'

interface CreateStatementFabProps {
  accountId: number
  accountType: AccountType
  currency: CurrencyRead | undefined
  statements: StatementRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: StatementCreate) => void
  isPending: boolean
}

export function CreateStatementFab({
  accountId,
  accountType,
  currency,
  statements,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: CreateStatementFabProps) {
  return (
    <FabSheet
      open={open}
      onOpenChange={onOpenChange}
      hotkey="n"
      label="New statement"
      title="New statement"
    >
      <CreateStatementForm
        accountId={accountId}
        accountType={accountType}
        currency={currency}
        statements={statements}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
