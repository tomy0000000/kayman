import { useState } from 'react'

import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { KbdForm } from '@/components/kbd-form'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { ZonedTimePicker } from '@/components/zoned-time-picker'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type AccountRead,
  type CurrencyRead,
  type TransactionPost,
  type TransactionReadWithBalance
} from '@/lib/client'
import { isAmount, toZonedISOString, withTime } from '@/lib/utils'

interface TransactionPostSheetProps {
  transaction: TransactionReadWithBalance | null
  account?: AccountRead
  currency: CurrencyRead | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: TransactionPost) => void
  isPending: boolean
}

export function TransactionPostSheet({
  transaction,
  account,
  currency,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: TransactionPostSheetProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const [txnId, setTxnId] = useState(transaction?.id)
  const [postedAt, setPostedAt] = useState(() =>
    toZonedISOString(
      withTime(new Date(), '00:00:00', clientTimezone),
      clientTimezone
    )
  )
  // The bank may post a different amount than the pending value; pre-fill
  // with the current amount and let the user adjust.
  const [amount, setAmount] = useState(() => transaction?.amount ?? '')

  // Re-initialize the form whenever a different transaction is picked, while
  // keeping the sheet itself mounted so it can animate open/closed.
  if (transaction && transaction.id !== txnId) {
    setTxnId(transaction.id)
    setPostedAt(
      toZonedISOString(
        withTime(new Date(), '00:00:00', clientTimezone),
        clientTimezone
      )
    )
    setAmount(transaction.amount)
  }

  const timezone = account?.timezone ?? clientTimezone

  const handleSubmit = () => {
    onSubmit({
      posted_at: postedAt,
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
          <SheetTitle>Post transaction</SheetTitle>
        </SheetHeader>
        <KbdForm
          onSubmit={handleSubmit}
          isPending={isPending}
          disabled={!isAmount(amount)}
          submitLabel="Post"
          submitPendingLabel="Posting..."
        >
          <Field>
            <FieldLabel htmlFor="post-posted-at">Posted at</FieldLabel>
            <ZonedTimePicker
              id="post-posted-at"
              value={new Date(postedAt)}
              timezone={timezone}
              onChange={setPostedAt}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="post-amount">Amount</FieldLabel>
            <CurrencyAmountInput
              id="post-amount"
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
