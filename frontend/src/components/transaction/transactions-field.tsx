import { ArrowLeftRight, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { type RefObject, useRef } from 'react'

import { AccountSelect } from '@/components/account-select'
import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { DragHandle } from '@/components/drag-handle'
import { FieldEmpty } from '@/components/field-empty'
import { type SelectedTransaction } from '@/components/link-transactions-table'
import { TransactionTagsPopover } from '@/components/transaction/transaction-tags-popover'
import { TransactionsLinkDialog } from '@/components/transaction/transactions-link-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  type AccountRead,
  type CurrencyRead,
  type TransactionTagRead
} from '@/lib/client'
import {
  type TransactionDraft,
  componentKey,
  toTransactionDraft
} from '@/lib/types'

interface TransactionsFieldProps {
  accounts: AccountRead[]
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
  value: TransactionDraft[]
  onChange: (value: TransactionDraft[]) => void
}

interface TransactionRowProps {
  transaction: TransactionDraft
  accounts: AccountRead[]
  currencies: CurrencyRead[]
  transactionTags: TransactionTagRead[]
  constraints: RefObject<HTMLTableSectionElement | null>
  onChange: (transaction: TransactionDraft) => void
  onRemove: (key: string) => void
}

export function TransactionsField({
  accounts,
  currencies,
  transactionTags,
  value,
  onChange
}: TransactionsFieldProps) {
  // A row dragged past the table is clipped by the scroll container `Table`
  // wraps it in, so keep the drag inside the body.
  const body = useRef<HTMLTableSectionElement>(null)

  const addTransaction = () =>
    onChange([
      ...value,
      { key: componentKey(), id: null, accountId: null, amount: '', tagIds: [] }
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
    return (
      <FieldEmpty
        icon={ArrowLeftRight}
        title="No transactions"
        description="Record the money movement behind this event."
      >
        {actions}
      </FieldEmpty>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader className="max-sm:hidden">
            <TableRow>
              <TableHead className="w-6 px-0" />
              <TableHead>Account</TableHead>
              <TableHead className="w-44">Amount</TableHead>
              <TableHead className="w-8 px-0" />
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
                currencies={currencies}
                transactionTags={transactionTags}
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
  currencies,
  transactionTags,
  constraints,
  onChange,
  onRemove
}: TransactionRowProps) {
  const dragControls = useDragControls()
  const account =
    accounts.find((item) => item.id === transaction.accountId) ?? null
  const currency = currencies.find(
    (item) => item.code === account?.currency_code
  )

  return (
    <Reorder.Item
      as="tr"
      value={transaction}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraints}
      dragElastic={0}
      className="relative border-b bg-background max-sm:grid max-sm:grid-cols-[auto_1fr_auto_auto] max-sm:items-center"
    >
      <TableCell className="px-0 max-sm:row-span-2">
        <DragHandle dragControls={dragControls} className="max-sm:px-2" />
      </TableCell>
      <TableCell className="max-sm:col-span-2">
        <AccountSelect
          accounts={accounts}
          value={account}
          onValueChange={(selected) =>
            onChange({ ...transaction, accountId: selected.id })
          }
        />
      </TableCell>
      <TableCell className="max-sm:col-start-2">
        <CurrencyAmountInput
          currency={currency}
          amount={transaction.amount}
          onAmountChange={(amount) => onChange({ ...transaction, amount })}
        />
      </TableCell>
      <TableCell className="px-0">
        <TransactionTagsPopover
          tags={transactionTags}
          value={transaction.tagIds}
          onValueChange={(tagIds) => onChange({ ...transaction, tagIds })}
        />
      </TableCell>
      <TableCell className="px-0 max-sm:col-start-4 max-sm:row-span-2 max-sm:row-start-1">
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
