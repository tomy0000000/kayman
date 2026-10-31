import { Amount } from '@/components/amount'
import { ClearBanner } from '@/components/clear-banner'
import { ResponsiveSheet } from '@/components/responsive-sheet'
import { TransactionStatusBadge } from '@/components/transaction/transaction-status-badge'
import { TransactionTagBadge } from '@/components/transaction/transaction-tag-badge'
import { TransactionTimeline } from '@/components/transaction/transaction-timeline'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type AccountRead,
  type TransactionClearError,
  type TransactionReadWithBalance
} from '@/lib/client'
import { summarizeTransactionEvent } from '@/lib/events'
import { formatDateTime } from '@/lib/utils'

interface TransactionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Kept while closing, so the body does not vanish mid animation.
  transaction: TransactionReadWithBalance | null
  account?: AccountRead
  categoryNames: Map<number, string>
  accountNames: Map<number, string>
  clearErrors: TransactionClearError[]
  isClearableLoading: boolean
  onClear: () => void
  isClearPending: boolean
}

interface DetailRowProps {
  label: string
  children: React.ReactNode
}

export function TransactionSheet({
  open,
  onOpenChange,
  transaction,
  account,
  categoryNames,
  accountNames,
  clearErrors,
  isClearableLoading,
  onClear,
  isClearPending
}: TransactionSheetProps) {
  const { timezone } = useClientTimezone()

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Transaction details"
    >
      {transaction && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
          <div className="flex flex-col items-center gap-1 text-center">
            <TransactionStatusBadge status={transaction.status} />
            <span className="font-semibold text-2xl tabular-nums">
              <Amount
                amount={Number(transaction.amount)}
                currencyCode={transaction.currency_code}
              />
            </span>
            {transaction.description && (
              <span className="font-semibold">{transaction.description}</span>
            )}
            <span className="text-muted-foreground text-xs">
              {formatDateTime(transaction.created_at, timezone)}
            </span>
            {account && account.timezone !== timezone && (
              <span className="text-muted-foreground text-xs">
                {formatDateTime(transaction.created_at, account.timezone)} (
                {account.timezone})
              </span>
            )}
            {transaction.tags && transaction.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1">
                {transaction.tags.map((tag) => (
                  <TransactionTagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>

          <div className="border-t" />

          <DetailRow label="Event">
            {transaction.event
              ? (summarizeTransactionEvent(
                  transaction,
                  categoryNames,
                  accountNames
                ).title ?? `#${transaction.event.id}`)
              : 'None'}
          </DetailRow>

          <div className="border-t" />

          <TransactionTimeline transaction={transaction} />

          {!transaction.cleared_at && (
            <ClearBanner
              subject="transaction"
              errors={clearErrors}
              isLoading={isClearableLoading}
              onClear={onClear}
              isClearPending={isClearPending}
            />
          )}
        </div>
      )}
    </ResponsiveSheet>
  )
}

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
