import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table'
import { useMemo } from 'react'

import { Amount } from '@/components/amount'
import { TransactionStatusBadge } from '@/components/transaction/transaction-status-badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { type TransactionReadWithBalance } from '@/lib/client'
import { summarizeTransactionEvent } from '@/lib/events'
import { cn, formatCurrency, formatDate, formatTime } from '@/lib/utils'

interface TransactionsTableProps {
  transactions: TransactionReadWithBalance[] | undefined
  currencyCode?: string
  categoryNames: Map<number, string>
  accountNames: Map<number, string>
  isPending: boolean
  onTransactionEdit?: (transaction: TransactionReadWithBalance) => void
  onTransactionDuplicate?: (transaction: TransactionReadWithBalance) => void
  onTransactionPost?: (transaction: TransactionReadWithBalance) => void
  onTransactionBill?: (transaction: TransactionReadWithBalance) => void
  onTransactionClear?: (transaction: TransactionReadWithBalance) => void
  onTransactionCreateEvent?: (transaction: TransactionReadWithBalance) => void
  onTransactionViewEvent?: (transaction: TransactionReadWithBalance) => void
  onTransactionGoToEvent?: (transaction: TransactionReadWithBalance) => void
}

// Stable reference for the empty state. A fresh `[]` per render makes
// react-table treat `data` as changed every render and loops forever.
const EMPTY_TRANSACTIONS: TransactionReadWithBalance[] = []

export function TransactionsTable({
  transactions,
  currencyCode,
  categoryNames,
  accountNames,
  isPending,
  onTransactionEdit,
  onTransactionDuplicate,
  onTransactionPost,
  onTransactionBill,
  onTransactionClear,
  onTransactionCreateEvent,
  onTransactionViewEvent,
  onTransactionGoToEvent
}: TransactionsTableProps) {
  const { timezone } = useClientTimezone()

  const columnWidths: Record<string, string> = {
    date: 'w-28',
    time: 'w-24',
    status: 'w-28',
    amount: 'w-36'
  }

  const columns = useMemo<ColumnDef<TransactionReadWithBalance>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        // Only render the date when it changes from the previous row, so
        // consecutive transactions on the same day read as one group.
        cell: ({ row, table }) => {
          const date = formatDate(row.original.created_at, timezone)
          const prev = table.getRowModel().rows[row.index - 1]
          const prevDate = prev
            ? formatDate(prev.original.created_at, timezone)
            : null
          return date === prevDate ? '' : date
        }
      },
      {
        id: 'time',
        header: 'Time',
        cell: ({ row }) => formatTime(row.original.created_at, timezone)
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => {
          const { title, subtitle, note } = summarizeTransactionEvent(
            row.original,
            categoryNames,
            accountNames
          )
          return (
            <div className="flex flex-col">
              {title && <span className="truncate font-semibold">{title}</span>}
              {subtitle && (
                <span className="truncate text-muted-foreground text-sm">
                  {subtitle}
                </span>
              )}
              {note && (
                <span className="truncate text-muted-foreground text-sm">
                  {note}
                </span>
              )}
            </div>
          )
        }
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <TransactionStatusBadge status={row.original.status} />
        )
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <div className="flex flex-col items-end">
            <Amount
              amount={parseFloat(row.original.amount)}
              currencyCode={currencyCode}
            />
            <span className="text-muted-foreground text-xs">
              {currencyCode
                ? formatCurrency(
                    parseFloat(row.original.running_balance),
                    currencyCode
                  )
                : row.original.running_balance}
            </span>
          </div>
        )
      }
    ],
    [accountNames, categoryNames, currencyCode, timezone]
  )

  // TanStack Table manages its own memoization; the React Compiler bail-out
  // for `useReactTable` is expected and safe here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: transactions ?? EMPTY_TRANSACTIONS,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <div className="overflow-hidden rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={columnWidths[header.column.id]}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>
                  <TableRow
                    className={cn(
                      row.original.id < 0 && 'pointer-events-none opacity-50'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <ContextMenuItem
                    disabled={row.original.status === 'CLEARED'}
                    onSelect={() => onTransactionEdit?.(row.original)}
                  >
                    Edit
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => onTransactionDuplicate?.(row.original)}
                  >
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    disabled={row.original.status !== 'PENDING'}
                    onSelect={() => onTransactionPost?.(row.original)}
                  >
                    Post
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={row.original.status !== 'POSTED'}
                    onSelect={() => onTransactionBill?.(row.original)}
                  >
                    Bill
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={
                      row.original.status !== 'BILLED' ||
                      row.original.event_id == null
                    }
                    onSelect={() => onTransactionClear?.(row.original)}
                  >
                    Clear
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    disabled={row.original.event_id != null}
                    onSelect={() => onTransactionCreateEvent?.(row.original)}
                  >
                    Create Event
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={row.original.event == null}
                    onSelect={() => onTransactionViewEvent?.(row.original)}
                  >
                    View Event
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={row.original.event == null}
                    onSelect={() => onTransactionGoToEvent?.(row.original)}
                  >
                    Go to Event
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))
          ) : isPending ? (
            Array.from({ length: 3 }, (_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10" />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3.5 w-24 max-w-full" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-10 text-center text-neutral-500"
              >
                No transactions
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
