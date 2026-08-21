import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table'
import { useMemo } from 'react'

import { Amount } from '@/components/amount'
import { EventTypeBadge } from '@/components/event/event-type-badge'
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
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { useIsMobile } from '@/hooks/use-mobile'
import type { EventReadDetailed, TransactionRead } from '@/lib/client'
import { cn, formatCurrency, formatTime } from '@/lib/utils'

interface EventsTableProps {
  events: EventReadDetailed[] | undefined
  categoryNames: Map<number, string>
  isPending: boolean
  onEventView?: (event: EventReadDetailed) => void
  onEventEdit?: (event: EventReadDetailed) => void
  onEventDuplicate?: (event: EventReadDetailed) => void
}

// Stable reference for the empty state. A fresh `[]` per render makes
// react-table treat `data` as changed every render and loops forever.
const EMPTY_EVENTS: EventReadDetailed[] = []

const COLUMN_WIDTHS: Record<string, string> = {
  timestamp: 'w-24',
  amount: 'w-32'
}

export function EventsTable({
  events,
  categoryNames,
  isPending,
  onEventView,
  onEventEdit,
  onEventDuplicate
}: EventsTableProps) {
  const { timezone } = useClientTimezone()
  const isMobile = useIsMobile()

  const columns = useMemo<ColumnDef<EventReadDetailed>[]>(() => {
    // A transaction's currency is its account's currency, already denormalized
    // onto the row as `currency_code` by the backend.
    const formatTransaction = (transaction: TransactionRead) =>
      formatCurrency(
        Math.abs(Number(transaction.amount)),
        transaction.currency_code
      )

    const renderAmount = (event: EventReadDetailed) => {
      if (event.type === 'Expense' || event.type === 'Income') {
        const total = event.entries.reduce(
          (sum, entry) => sum + Number(entry.amount) * entry.quantity,
          0
        )
        const signed = event.type === 'Expense' ? -total : total
        return (
          <Amount
            amount={signed}
            currencyCode={event.entries[0]?.currency_code}
          />
        )
      }
      if (event.type === 'Transfer') {
        const [transaction] = event.transactions
        return transaction ? formatTransaction(transaction) : '—'
      }
      // Exchange: each leg in its own account's currency.
      return event.transactions
        .map((transaction) => formatTransaction(transaction))
        .join(' / ')
    }

    return [
      {
        accessorKey: 'timestamp',
        header: 'Time',
        cell: ({ row }) => formatTime(row.original.timestamp, timezone)
      },
      {
        id: 'summary',
        header: 'Summary',
        cell: ({ row }) => {
          const labels = [
            ...new Set(
              row.original.entries.map((entry) => {
                const name =
                  categoryNames.get(entry.category_id) ??
                  `#${entry.category_id}`
                const description = entry.description?.trim()
                return description ? `${name} (${description})` : name
              })
            )
          ]
          return (
            <div className="flex flex-col">
              <span className="truncate font-semibold">
                {row.original.description}
              </span>
              {labels.length > 0 && (
                <span className="truncate text-muted-foreground text-sm">
                  {labels.join(', ')}
                </span>
              )}
            </div>
          )
        }
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <div className="flex max-w-full flex-col items-start">
            <EventTypeBadge type={row.original.type} />
            <span className="max-w-full truncate">
              {renderAmount(row.original)}
            </span>
          </div>
        )
      }
    ]
  }, [categoryNames, timezone])

  // TanStack Table manages its own memoization; the React Compiler bail-out
  // for `useReactTable` is expected and safe here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: events ?? EMPTY_EVENTS,
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
                  className={COLUMN_WIDTHS[header.column.id]}
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
                    className={cn('h-14', isMobile && 'cursor-pointer')}
                    onClick={
                      isMobile
                        ? (clickEvent) => {
                            // The long press that opens the context menu also
                            // ends in a click, so skip while it is open.
                            if (
                              clickEvent.currentTarget.dataset.state === 'open'
                            ) {
                              return
                            }
                            onEventView?.(row.original)
                          }
                        : undefined
                    }
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
                  <ContextMenuItem onSelect={() => onEventView?.(row.original)}>
                    View
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => onEventEdit?.(row.original)}>
                    Edit
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => onEventDuplicate?.(row.original)}
                  >
                    Duplicate
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
                {isPending ? 'Loading...' : 'No events'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
