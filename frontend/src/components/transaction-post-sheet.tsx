import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { KbdForm } from '@/components/kbd-form'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
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
  type TransactionPost,
  type TransactionReadWithBalance
} from '@/lib/client'
import { toZonedISOString } from '@/lib/utils'

interface TransactionPostSheetProps {
  transaction: TransactionReadWithBalance | null
  account?: AccountRead
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: TransactionPost) => void
  isPending: boolean
}

export function TransactionPostSheet({
  transaction,
  account,
  open,
  onOpenChange,
  onSubmit,
  isPending
}: TransactionPostSheetProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const [txnId, setTxnId] = useState(transaction?.id)
  const [postedAt, setPostedAt] = useState(() =>
    toZonedISOString(new Date(), clientTimezone)
  )
  // The bank may post a different amount than the pending value; pre-fill
  // with the current amount and let the user adjust.
  const [amount, setAmount] = useState(() =>
    transaction ? Math.abs(parseFloat(transaction.amount)).toString() : ''
  )
  const [negative, setNegative] = useState(
    () => transaction != null && parseFloat(transaction.amount) < 0
  )

  // Re-initialize the form whenever a different transaction is picked, while
  // keeping the sheet itself mounted so it can animate open/closed.
  if (transaction && transaction.id !== txnId) {
    setTxnId(transaction.id)
    setPostedAt(toZonedISOString(new Date(), clientTimezone))
    setAmount(Math.abs(parseFloat(transaction.amount)).toString())
    setNegative(parseFloat(transaction.amount) < 0)
  }

  const timezone = account?.timezone ?? clientTimezone

  const handleSubmit = () => {
    onSubmit({
      posted_at: postedAt,
      amount: negative ? `-${amount}` : amount
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
          disabled={amount === ''}
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
            <InputGroup>
              <InputGroupAddon>
                <InputGroupButton
                  size="icon-xs"
                  aria-pressed={negative}
                  aria-label={
                    negative ? 'Make amount positive' : 'Make amount negative'
                  }
                  onClick={() => setNegative((v) => !v)}
                >
                  {negative ? <Minus /> : <Plus />}
                </InputGroupButton>
                <InputGroupText>$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="post-amount"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/-/g, ''))}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{transaction?.currency_code}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </KbdForm>
      </SheetContent>
    </Sheet>
  )
}
