import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Amount } from '@/components/amount'
import { TransactionStatusBadge } from '@/components/transaction/transaction-status-badge'
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
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  type AccountRead,
  type StatementRead,
  type TransactionBill,
  type TransactionRead
} from '@/lib/client'
import { readTransactionsOptions } from '@/lib/client/@tanstack/react-query.gen'
import {
  addDecimals,
  cn,
  formatCurrency,
  formatMonthDayTime,
  formatPlainDate,
  negateDecimal,
  parseLocalDate,
  pluralize,
  zonedDayRange
} from '@/lib/utils'

interface StatementBillDialogProps {
  statement: StatementRead | null
  previousStatement: StatementRead | undefined
  account: AccountRead
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (bills: TransactionBill[]) => void
}

// Stable reference for the empty state, so the derived selection doesn't churn.
const EMPTY_TRANSACTIONS: TransactionRead[] = []

export function StatementBillDialog({
  statement,
  previousStatement,
  account,
  open,
  onOpenChange,
  onSubmit
}: StatementBillDialogProps) {
  const [statementId, setStatementId] = useState(statement?.id)
  // null until the user toggles a row, so the default follows the fetched rows.
  const [picked, setPicked] = useState<Set<number> | null>(null)

  if (statement && statement.id !== statementId) {
    setStatementId(statement.id)
    setPicked(null)
  }

  const periodStart = statement
    ? zonedDayRange(parseLocalDate(statement.period_start_on), account.timezone)
        .start
    : null
  const periodEnd = statement
    ? zonedDayRange(parseLocalDate(statement.period_end_on), account.timezone)
        .end
    : null

  const { isLoading: isPostedLoading, data: posted } = useQuery({
    ...readTransactionsOptions({
      query: {
        account_id: account.id,
        posted_start: periodStart,
        posted_end: periodEnd
      }
    }),
    enabled: open && statement != null
  })
  // Pending rows have no posted_at, so they're matched by created_at instead.
  const { isLoading: isCreatedLoading, data: created } = useQuery({
    ...readTransactionsOptions({
      query: { account_id: account.id, start: periodStart, end: periodEnd }
    }),
    enabled: open && statement != null
  })
  const isLoading = isPostedLoading || isCreatedLoading
  const transactions =
    posted || created
      ? [
          ...(posted ?? EMPTY_TRANSACTIONS),
          ...(created ?? EMPTY_TRANSACTIONS).filter(
            (transaction) => transaction.status === 'PENDING'
          )
        ].sort((a, b) =>
          (a.posted_at ?? a.created_at).localeCompare(
            b.posted_at ?? b.created_at
          )
        )
      : EMPTY_TRANSACTIONS

  // Rows already on this statement stay checked and count toward the sum.
  const pickedIds =
    picked ??
    new Set(
      transactions
        .filter((transaction) => transaction.status === 'POSTED')
        .map((transaction) => transaction.id)
    )
  const selected = transactions.filter(
    (transaction) =>
      pickedIds.has(transaction.id) ||
      (statement != null && transaction.statement_id === statement.id)
  )
  const selectedIds = new Set(selected.map((transaction) => transaction.id))
  const toBill = selected.filter(
    (transaction) => transaction.status === 'POSTED'
  )

  const toggle = (transaction: TransactionRead) => {
    if (transaction.status !== 'POSTED') return
    const next = new Set(pickedIds)
    if (next.has(transaction.id)) next.delete(transaction.id)
    else next.add(transaction.id)
    setPicked(next)
  }

  const selectedSum = selected.reduce(
    (sum, transaction) => addDecimals(sum, transaction.amount),
    '0'
  )
  const expected = addDecimals(previousStatement?.balance ?? '0', selectedSum)
  const difference = statement
    ? Number(addDecimals(statement.balance, negateDecimal(expected)))
    : 0
  const format = (value: string | number) =>
    formatCurrency(Number(value), account.currency_code)

  const handleOpenChange = (next: boolean) => {
    if (!next) setPicked(null)
    onOpenChange(next)
  }

  const handleSubmit = () => {
    if (!statement || toBill.length === 0) return
    onSubmit(
      toBill.map((transaction) => ({
        transaction_id: transaction.id,
        statement_id: statement.id
      }))
    )
  }

  useHotkeys('mod+enter', handleSubmit, {
    enabled: open,
    enableOnFormTags: true,
    preventDefault: true
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="min-w-sm sm:min-w-sm sm:max-w-[min(calc(100%-2rem),48rem)]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Bill transactions</DialogTitle>
          <DialogDescription>
            {statement &&
              `Transactions posted ${formatPlainDate(statement.period_start_on)} – ${formatPlainDate(statement.period_end_on)}, plus pending ones created in that period.`}
          </DialogDescription>
        </DialogHeader>

        <div className="h-66 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length ? (
                transactions.map((transaction) => {
                  const billable = transaction.status === 'POSTED'
                  return (
                    <TableRow
                      key={transaction.id}
                      data-state={
                        selectedIds.has(transaction.id) ? 'selected' : undefined
                      }
                      onClick={() => toggle(transaction)}
                      className={cn(
                        billable ? 'cursor-pointer' : 'text-muted-foreground'
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(transaction.id)}
                          disabled={!billable}
                          onCheckedChange={() => toggle(transaction)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select transaction"
                        />
                      </TableCell>
                      <TableCell>
                        {formatMonthDayTime(
                          transaction.posted_at ?? transaction.created_at,
                          account.timezone
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell>
                        <Amount
                          amount={parseFloat(transaction.amount)}
                          currencyCode={account.currency_code}
                        />
                      </TableCell>
                      <TableCell>
                        <TransactionStatusBadge status={transaction.status} />
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : isLoading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="size-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32 max-w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-66 text-center text-muted-foreground"
                  >
                    No transactions in this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm [&>dd]:pl-4">
          <dt className="text-muted-foreground">Previous balance</dt>
          <dd className="text-right">
            {format(previousStatement?.balance ?? 0)}
          </dd>
          <dt className="text-muted-foreground">
            + Selected (
            {pluralize(selected.length, 'transaction', 'transactions')})
          </dt>
          <dd className="text-right">{format(selectedSum)}</dd>
          <dt className="border-t pt-1 text-muted-foreground">
            = Expected balance
          </dt>
          <dd className="border-t pt-1 text-right">{format(expected)}</dd>
          <dt className="mt-2 text-muted-foreground">Statement balance</dt>
          <dd className="mt-2 text-right">
            {statement && format(statement.balance)}
          </dd>
          <dt className="font-medium">Difference</dt>
          <dd
            className={cn(
              'text-right font-medium',
              difference !== 0 && 'text-destructive'
            )}
          >
            {format(difference)}
          </dd>
        </dl>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel <Kbd>Esc</Kbd>
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={toBill.length === 0}
            onClick={handleSubmit}
          >
            Bill{' '}
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
