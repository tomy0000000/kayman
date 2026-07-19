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
import type {
  AccountRead,
  CategoryReadWithChildren,
  EventReadDetailed
} from '@/lib/client'
import { buildCategoryNameMap } from '@/lib/types'
import { formatCurrency, formatTime } from '@/lib/utils'

interface EventsTableProps {
  events: EventReadDetailed[] | undefined
  accounts: AccountRead[]
  categories: CategoryReadWithChildren[]
  isPending: boolean
  onEventEdit?: (event: EventReadDetailed) => void
}

// Stable reference for the empty state. A fresh `[]` per render makes
// react-table treat `data` as changed every render and loops forever.
const EMPTY_EVENTS: EventReadDetailed[] = []

export function EventsTable({
  events,
  accounts,
  categories,
  isPending,
  onEventEdit
}: EventsTableProps) {
  const categoryNames = useMemo(
    () => buildCategoryNameMap(categories),
    [categories]
  )
  const accountCurrencies = useMemo(
    () =>
      new Map(accounts.map((account) => [account.id, account.currency_code])),
    [accounts]
  )

  const columns = useMemo<ColumnDef<EventReadDetailed>[]>(() => {
    // A transaction's currency is its account's currency (transactions carry no
    // currency of their own). Formats the magnitude; falls back to the raw
    // number until accounts have loaded.
    const formatTransaction = (accountId: number, amount: string) => {
      const currency = accountCurrencies.get(accountId)
      const value = Math.abs(Number(amount))
      return currency ? formatCurrency(value, currency) : String(value)
    }

    return [
      {
        accessorKey: 'timestamp',
        header: 'Time',
        cell: ({ row }) => formatTime(row.original.timestamp)
      },
      {
        id: 'summary',
        header: 'Summary',
        cell: ({ row }) => {
          const description = row.original.description?.trim()
          if (description) return description
          const names = [
            ...new Set(
              row.original.entries.map(
                (entry) =>
                  categoryNames.get(entry.category_id) ??
                  `#${entry.category_id}`
              )
            )
          ]
          return names.length ? names.join(', ') : '—'
        }
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => <EventTypeBadge type={row.original.type} />
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => {
          const event = row.original
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
            return transaction
              ? formatTransaction(transaction.account_id, transaction.amount)
              : '—'
          }
          // Exchange: each leg in its own account's currency.
          return event.transactions
            .map((transaction) =>
              formatTransaction(transaction.account_id, transaction.amount)
            )
            .join(' / ')
        }
      }
    ]
  }, [categoryNames, accountCurrencies])

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
                  <ContextMenuItem onSelect={() => onEventEdit?.(row.original)}>
                    Edit
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
