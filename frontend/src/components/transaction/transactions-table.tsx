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
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'

interface TransactionsTableProps {
  transactions: TransactionReadWithBalance[] | undefined
  currencyCode?: string
  isPending: boolean
  onTransactionEdit?: (transaction: TransactionReadWithBalance) => void
  onTransactionDuplicate?: (transaction: TransactionReadWithBalance) => void
  onTransactionPost?: (transaction: TransactionReadWithBalance) => void
  onTransactionCreateEvent?: (transaction: TransactionReadWithBalance) => void
  onTransactionGoToEvent?: (transaction: TransactionReadWithBalance) => void
}

// Stable reference for the empty state. A fresh `[]` per render makes
// react-table treat `data` as changed every render and loops forever.
const EMPTY_TRANSACTIONS: TransactionReadWithBalance[] = []

export function TransactionsTable({
  transactions,
  currencyCode,
  isPending,
  onTransactionEdit,
  onTransactionDuplicate,
  onTransactionPost,
  onTransactionCreateEvent,
  onTransactionGoToEvent
}: TransactionsTableProps) {
  const { timezone } = useClientTimezone()

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
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold">
              {row.original.event?.description}
            </span>
            {row.original.description && (
              <span className="text-muted-foreground text-sm">
                {row.original.description}
              </span>
            )}
          </div>
        )
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
    [currencyCode, timezone]
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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
                  <TableRow>
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
                    onSelect={() => onTransactionEdit?.(row.original)}
                  >
                    Edit
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => onTransactionDuplicate?.(row.original)}
                  >
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={row.original.status !== 'PENDING'}
                    onSelect={() => onTransactionPost?.(row.original)}
                  >
                    Post
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={row.original.event_id != null}
                    onSelect={() => onTransactionCreateEvent?.(row.original)}
                  >
                    Create Event
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
