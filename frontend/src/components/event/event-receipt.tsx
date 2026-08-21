import { useMemo } from 'react'

import { Amount } from '@/components/amount'
import { EventTypeBadge } from '@/components/event/event-type-badge'
import { TransactionStatusBadge } from '@/components/transaction/transaction-status-badge'
import { TransactionTagBadge } from '@/components/transaction/transaction-tag-badge'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import type { AccountRead, CategoryRead, EventReadDetailed } from '@/lib/client'
import { buildCategoryNameMap } from '@/lib/types'
import { formatCurrency, formatDateTime, sumByCurrency } from '@/lib/utils'

interface EventReceiptProps {
  event: EventReadDetailed
  categories: CategoryRead[]
  accounts: AccountRead[]
}

interface ReceiptLineProps {
  label: string
  note?: string | null
  detail?: string
  badges?: React.ReactNode
  children: React.ReactNode
}

interface ReceiptTotalProps {
  label: string
  totals: Map<string, number>
  signed?: boolean
}

export function EventReceipt({
  event,
  categories,
  accounts
}: EventReceiptProps) {
  const { timezone } = useClientTimezone()
  const categoryNames = useMemo(
    () => buildCategoryNameMap(categories),
    [categories]
  )
  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  )

  const entryTotals = sumByCurrency(
    event.entries.map((entry) => ({
      amount: Number(entry.amount) * entry.quantity,
      currencyCode: entry.currency_code
    }))
  )
  const transactionTotals = sumByCurrency(
    event.transactions.map((transaction) => ({
      amount: Number(transaction.amount),
      currencyCode: transaction.currency_code
    }))
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <EventTypeBadge type={event.type} />
        {event.description && (
          <span className="font-semibold">{event.description}</span>
        )}
        <span className="text-muted-foreground text-xs">
          {formatDateTime(event.timestamp, timezone)}
        </span>
        {event.timezone !== timezone && (
          <span className="text-muted-foreground text-xs">
            {formatDateTime(event.timestamp, event.timezone)} ({event.timezone})
          </span>
        )}
      </div>

      {/* Transfer and Exchange carry no entries, so the section is dropped
          rather than rendered empty. */}
      {event.entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {event.entries.map((entry) => (
            <ReceiptLine
              key={entry.id}
              label={
                categoryNames.get(entry.category_id) ?? `#${entry.category_id}`
              }
              note={entry.description}
              detail={
                entry.quantity === 1
                  ? undefined
                  : `${entry.quantity} × ${formatCurrency(
                      Number(entry.amount),
                      entry.currency_code
                    )}`
              }
            >
              {formatCurrency(
                Number(entry.amount) * entry.quantity,
                entry.currency_code
              )}
            </ReceiptLine>
          ))}
          <ReceiptTotal label="Subtotal" totals={entryTotals} />
        </div>
      )}

      <div className="border-t" />

      <div className="flex flex-col gap-3">
        {event.transactions.length === 0 ? (
          <span className="text-muted-foreground">No transactions</span>
        ) : (
          event.transactions.map((transaction) => (
            <ReceiptLine
              key={transaction.id}
              label={
                accountNames.get(transaction.account_id) ??
                `#${transaction.account_id}`
              }
              note={transaction.description}
              badges={
                <>
                  <TransactionStatusBadge status={transaction.status} />
                  {transaction.tags?.map((tag) => (
                    <TransactionTagBadge key={tag.id} tag={tag} />
                  ))}
                </>
              }
            >
              <Amount
                amount={Number(transaction.amount)}
                currencyCode={transaction.currency_code}
              />
            </ReceiptLine>
          ))
        )}
        <ReceiptTotal label="Total" totals={transactionTotals} signed />
      </div>

      {event.cleared_at && (
        <span className="text-center text-muted-foreground text-xs">
          Cleared {formatDateTime(event.cleared_at, timezone)}
        </span>
      )}
    </div>
  )
}

function ReceiptLine({
  label,
  note,
  detail,
  badges,
  children
}: ReceiptLineProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate">{label}</span>
        {note && (
          <span className="truncate text-muted-foreground text-xs">{note}</span>
        )}
        {detail && (
          <span className="text-muted-foreground text-xs">{detail}</span>
        )}
        {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
      </div>
      <span className="whitespace-nowrap tabular-nums">{children}</span>
    </div>
  )
}

function ReceiptTotal({ label, totals, signed }: ReceiptTotalProps) {
  // An event can carry no transactions at all, and a total of nothing is a
  // rule with no line under it.
  if (totals.size === 0) return null

  return (
    <div className="flex flex-col gap-1 border-t border-dashed pt-3 font-semibold">
      {[...totals].map(([currencyCode, total]) => (
        <div key={currencyCode} className="flex justify-between gap-4">
          <span>{label}</span>
          <span className="whitespace-nowrap tabular-nums">
            {signed ? (
              <Amount amount={total} currencyCode={currencyCode} />
            ) : (
              formatCurrency(total, currencyCode)
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
