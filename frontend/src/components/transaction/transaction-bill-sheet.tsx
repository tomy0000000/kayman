import { useState } from 'react'

import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { KbdForm } from '@/components/kbd-form'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type AccountRead,
  type CurrencyRead,
  type StatementRead,
  type TransactionBillLegacy,
  type TransactionReadWithBalance
} from '@/lib/client'
import { statementForDay } from '@/lib/statements'
import { formatPlainDate, isAmount, zonedDayKey } from '@/lib/utils'

interface TransactionBillSheetProps {
  transaction: TransactionReadWithBalance | null
  account?: AccountRead
  currency: CurrencyRead | null | undefined
  statements: StatementRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: TransactionBillLegacy) => void
  isPending: boolean
}

export function TransactionBillSheet({
  transaction,
  account,
  currency,
  statements,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: TransactionBillSheetProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const [txnId, setTxnId] = useState(transaction?.id)
  // null until the user picks, so the default can follow statements that load
  // after the sheet opens.
  const [pickedStatementId, setPickedStatementId] = useState<string | null>(
    null
  )
  // The statement may finalize a different amount than the posted value.
  const [amount, setAmount] = useState(() => transaction?.amount ?? '')

  // Re-initialize the form whenever a different transaction is picked, while
  // keeping the sheet itself mounted so it can animate open/closed.
  if (transaction && transaction.id !== txnId) {
    setTxnId(transaction.id)
    setPickedStatementId(null)
    setAmount(transaction.amount)
  }

  const timezone = account?.timezone ?? clientTimezone
  const postedOn = transaction?.posted_at
    ? zonedDayKey(transaction.posted_at, timezone)
    : null
  const defaultStatement = postedOn
    ? statementForDay(statements, postedOn)
    : undefined
  const statementId = pickedStatementId ?? defaultStatement?.id.toString() ?? ''

  const ordered = [...statements].sort((a, b) =>
    b.period_end_on.localeCompare(a.period_end_on)
  )

  const handleSubmit = () => {
    onSubmit({
      statement_id: Number(statementId),
      amount
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="flex flex-col"
        onFocusOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Bill transaction</SheetTitle>
        </SheetHeader>
        <KbdForm
          onSubmit={handleSubmit}
          isPending={isPending}
          disabled={statementId === '' || !isAmount(amount)}
          submitLabel="Bill"
          submitPendingLabel="Billing..."
        >
          <Field>
            <FieldLabel htmlFor="bill-statement">Statement</FieldLabel>
            <Select value={statementId} onValueChange={setPickedStatementId}>
              <SelectTrigger id="bill-statement" className="w-full font-normal">
                <SelectValue placeholder="Select a statement" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="max-h-72"
              >
                {ordered.map((statement) => (
                  <SelectItem
                    key={statement.id}
                    value={statement.id.toString()}
                  >
                    {formatPlainDate(statement.period_start_on)} –{' '}
                    {formatPlainDate(statement.period_end_on)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="bill-amount">Amount</FieldLabel>
            <CurrencyAmountInput
              id="bill-amount"
              amount={amount}
              onAmountChange={setAmount}
              currency={currency}
              required
            />
          </Field>
        </KbdForm>
      </SheetContent>
    </Sheet>
  )
}
