import { GripVertical, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { type RefObject, useRef } from 'react'

import { AccountSelect } from '@/components/account-select'
import { type SelectedTransaction } from '@/components/link-transactions-table'
import { TransactionEmpty } from '@/components/transaction/transaction-empty'
import { TransactionsLinkDialog } from '@/components/transaction/transactions-link-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { type AccountRead } from '@/lib/client'
import {
  type TransactionDraft,
  componentKey,
  toTransactionDraft
} from '@/lib/types'

interface TransactionsFieldProps {
  accounts: AccountRead[]
  value: TransactionDraft[]
  onChange: (value: TransactionDraft[]) => void
}

interface TransactionRowProps {
  transaction: TransactionDraft
  accounts: AccountRead[]
  constraints: RefObject<HTMLTableSectionElement | null>
  onChange: (transaction: TransactionDraft) => void
  onRemove: (key: string) => void
}

export function TransactionsField({
  accounts,
  value,
  onChange
}: TransactionsFieldProps) {
  // A row dragged past the table is clipped by the scroll container `Table`
  // wraps it in, so keep the drag inside the body.
  const body = useRef<HTMLTableSectionElement>(null)

  const addTransaction = () =>
    onChange([
      ...value,
      { key: componentKey(), id: null, accountId: null, amount: '' }
    ])

  const linkTransactions = (selection: SelectedTransaction[]) => {
    const existing = new Set(value.map((item) => item.id))
    const additions = selection
      .filter((item) => !existing.has(item.transaction.id))
      .map((item) => toTransactionDraft(item.transaction))
    if (additions.length > 0) onChange([...value, ...additions])
  }

  const updateTransaction = (transaction: TransactionDraft) =>
    onChange(
      value.map((item) => (item.key === transaction.key ? transaction : item))
    )

  const removeTransaction = (key: string) =>
    onChange(value.filter((item) => item.key !== key))

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addTransaction}
      >
        Add transaction
      </Button>
      <TransactionsLinkDialog accounts={accounts} onLink={linkTransactions}>
        <Button type="button" variant="outline" size="sm">
          Link existing
        </Button>
      </TransactionsLinkDialog>
    </>
  )

  if (value.length === 0) {
    return <TransactionEmpty>{actions}</TransactionEmpty>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6 px-0" />
              <TableHead>Account</TableHead>
              <TableHead className="w-32">Amount</TableHead>
              <TableHead className="w-8 px-0" />
            </TableRow>
          </TableHeader>
          <Reorder.Group
            as="tbody"
            ref={body}
            axis="y"
            values={value}
            onReorder={onChange}
            className="[&_tr:last-child]:border-0"
          >
            {value.map((transaction) => (
              <TransactionRow
                key={transaction.key}
                transaction={transaction}
                accounts={accounts}
                constraints={body}
                onChange={updateTransaction}
                onRemove={removeTransaction}
              />
            ))}
          </Reorder.Group>
        </Table>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  )
}

function TransactionRow({
  transaction,
  accounts,
  constraints,
  onChange,
  onRemove
}: TransactionRowProps) {
  const dragControls = useDragControls()
  const account =
    accounts.find((item) => item.id === transaction.accountId) ?? null

  return (
    <Reorder.Item
      as="tr"
      value={transaction}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraints}
      dragElastic={0}
      className="relative border-b bg-background"
    >
      <TableCell className="px-0">
        <span
          aria-label="Drag to reorder"
          className="flex cursor-grab touch-none items-center text-muted-foreground select-none active:cursor-grabbing"
          // Suppress the compatibility mousedown, which would otherwise start a
          // text selection that follows the drag across the page.
          onPointerDown={(e) => {
            e.preventDefault()
            dragControls.start(e)
          }}
        >
          <GripVertical className="size-4" />
        </span>
      </TableCell>
      <TableCell>
        <AccountSelect
          accounts={accounts}
          value={account}
          onValueChange={(selected) =>
            onChange({ ...transaction, accountId: selected.id })
          }
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={transaction.amount}
          onChange={(e) => onChange({ ...transaction, amount: e.target.value })}
        />
      </TableCell>
      <TableCell className="px-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove transaction"
          onClick={() => onRemove(transaction.key)}
        >
          <X />
        </Button>
      </TableCell>
    </Reorder.Item>
  )
}
