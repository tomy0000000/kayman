import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useHotkeys } from 'react-hotkeys-hook'

import { Amount } from '@/components/amount'
import { TransactionTagBadge } from '@/components/transaction/transaction-tag-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { type AccountType, type TransactionReadWithBalance } from '@/lib/client'
import { readStatementsOptions } from '@/lib/client/@tanstack/react-query.gen'
import { formatDateTime, formatPlainDate } from '@/lib/utils'

interface TransactionClearDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: TransactionReadWithBalance
  timezone: string
  accountType?: AccountType
  onConfirm: () => void
}

// Focus moves by script, which skips :focus-visible after a mouse click, so ring on any focus.
const FOCUS_CLASSES = 'focus:border-ring focus:ring-3 focus:ring-ring/50'

interface CheckItem {
  key: string
  label: React.ReactNode
}

export function TransactionClearDialog({
  open,
  onOpenChange,
  transaction,
  timezone,
  accountType,
  onConfirm
}: TransactionClearDialogProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const checkboxRefs = useRef(new Map<string, HTMLButtonElement>())
  const clearButtonRef = useRef<HTMLButtonElement>(null)

  const { data: statements } = useQuery({
    ...readStatementsOptions({
      query: { statement_id: transaction.statement_id }
    }),
    enabled: open && transaction.statement_id != null
  })
  const statement = statements?.[0]

  const items: CheckItem[] = [
    {
      key: 'amount',
      label: (
        <span>
          The amount is{' '}
          <Amount
            amount={Number(transaction.amount)}
            currencyCode={transaction.currency_code}
          />
        </span>
      )
    },
    {
      key: 'timestamp',
      label: (
        <span>
          It happened at {formatDateTime(transaction.created_at, timezone)}
        </span>
      )
    },
    // Card tags record the payment method, and no tag means the physical card.
    ...(accountType === 'CREDIT_CARD'
      ? [
          {
            key: 'tags',
            label:
              transaction.tags && transaction.tags.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1">
                  Tagged{' '}
                  {transaction.tags.map((tag) => (
                    <TransactionTagBadge key={tag.id} tag={tag} />
                  ))}
                </span>
              ) : (
                <span>It was paid with the physical card</span>
              )
          }
        ]
      : []),
    {
      key: 'statement',
      label:
        transaction.statement_id == null ? (
          <span>It is not on a statement</span>
        ) : (
          <span>
            It is on the statement for{' '}
            {statement
              ? `${formatPlainDate(statement.period_start_on)} – ${formatPlainDate(statement.period_end_on)}`
              : `#${transaction.statement_id}`}
          </span>
        )
    }
  ]
  const allChecked = items.every((item) => checked.has(item.key))

  const toggle = (key: string) => {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    // Commit first, so the Clear button is enabled by the time it takes focus.
    flushSync(() => setChecked(next))
    if (!next.has(key)) return
    const index = items.findIndex((item) => item.key === key)
    const nextItem = [...items.slice(index + 1), ...items.slice(0, index)].find(
      (item) => !next.has(item.key)
    )
    if (nextItem) checkboxRefs.current.get(nextItem.key)?.focus()
    else clearButtonRef.current?.focus()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setChecked(new Set())
    onOpenChange(next)
  }

  const handleConfirm = () => {
    if (!allChecked) return
    setChecked(new Set())
    onConfirm()
  }

  useHotkeys('mod+enter', handleConfirm, {
    enabled: open,
    preventDefault: true
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          checkboxRefs.current.get(items[0].key)?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Clear transaction</DialogTitle>
          <DialogDescription>
            Confirm every detail before clearing.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup data-slot="checkbox-group">
          {items.map((item) => (
            <Field key={item.key} orientation="horizontal">
              <Checkbox
                id={`clear-check-${item.key}`}
                ref={(element) => {
                  if (element) checkboxRefs.current.set(item.key, element)
                  else checkboxRefs.current.delete(item.key)
                }}
                checked={checked.has(item.key)}
                onCheckedChange={() => toggle(item.key)}
                className={FOCUS_CLASSES}
              />
              <FieldLabel
                htmlFor={`clear-check-${item.key}`}
                className="font-normal"
              >
                {item.label}
              </FieldLabel>
            </Field>
          ))}
        </FieldGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel <Kbd>Esc</Kbd>
            </Button>
          </DialogClose>
          <Button
            ref={clearButtonRef}
            type="button"
            className={FOCUS_CLASSES}
            disabled={!allChecked}
            onClick={handleConfirm}
          >
            Clear{' '}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
