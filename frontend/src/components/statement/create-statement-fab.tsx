import { FabSheet } from '@/components/fab-sheet'
import { CreateStatementForm } from '@/components/statement/create-statement-form'
import {
  type CurrencyRead,
  type StatementCreate,
  type StatementRead
} from '@/lib/client'

interface CreateStatementFabProps {
  accountId: number
  currency: CurrencyRead | undefined
  statements: StatementRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: StatementCreate) => void
  isPending: boolean
}

export function CreateStatementFab({
  accountId,
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
        currency={currency}
        statements={statements}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </FabSheet>
  )
}
