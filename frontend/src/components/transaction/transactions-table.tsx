import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table'
import { useMemo } from 'react'

import { Amount } from '@/components/amount'
import { TransactionStatusBadge } from '@/components/transaction-status-badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { type TransactionReadWithBalance } from '@/lib/client'
import { formatCurrency, formatTime } from '@/lib/utils'

interface TransactionsTableProps {
  transactions: TransactionReadWithBalance[] | undefined
  currencyCode?: string
  isPending: boolean
  onTransactionEdit?: (transaction: TransactionReadWithBalance) => void
  onTransactionPost?: (transaction: TransactionReadWithBalance) => void
}

// Stable reference for the empty state. A fresh `[]` per render makes
// react-table treat `data` as changed every render and loops forever.
const EMPTY_TRANSACTIONS: TransactionReadWithBalance[] = []

export function TransactionsTable({
  transactions,
  currencyCode,
  isPending,
  onTransactionEdit,
  onTransactionPost
}: TransactionsTableProps) {
  const columns = useMemo<ColumnDef<TransactionReadWithBalance>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        // Only render the date when it changes from the previous row, so
        // consecutive transactions on the same day read as one group.
        cell: ({ row, table }) => {
          const date = new Date(row.original.created_at).toLocaleDateString()
          const prev = table.getRowModel().rows[row.index - 1]
          const prevDate = prev
            ? new Date(prev.original.created_at).toLocaleDateString()
            : null
          return date === prevDate ? '' : date
        }
      },
      {
        id: 'time',
        header: 'Time',
        cell: ({ row }) => formatTime(row.original.created_at)
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.description}</span>
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
    [currencyCode]
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
                    disabled={row.original.status !== 'PENDING'}
                    onSelect={() => onTransactionPost?.(row.original)}
                  >
                    Post
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-10 text-center text-neutral-500"
              >
                {isPending ? 'Loading...' : 'No transactions'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
