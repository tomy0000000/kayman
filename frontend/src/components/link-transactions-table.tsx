import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Table as TanstackTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from '@tanstack/react-table'
import { ListFilter } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AccountSelect } from '@/components/account-select'
import { Amount } from '@/components/amount'
import { TransactionStatusBadge } from '@/components/transaction-status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
  type TransactionRead,
  type TransactionStatus
} from '@/lib/client'
import { readTransactionsOptions } from '@/lib/client/@tanstack/react-query.gen'
import { cn, formatDateTime } from '@/lib/utils'

type StatusFilter = TransactionStatus | 'ALL'

export interface SelectedTransaction {
  transaction: TransactionRead
  account: AccountRead
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CLEARED', label: 'Cleared' }
]

// Stable reference for the empty state. A fresh `[]` per render makes
// react-table treat `data` as changed every render and loops forever.
const EMPTY_TRANSACTIONS: TransactionRead[] = []

// The active filter is read from the controlled `columnFilters` React state
// (via meta), not from `column.getFilterValue()`, which lags a render behind
// when read inside a flexRender'd header.
interface TransactionsTableMeta {
  statusFilter: StatusFilter
  setStatusFilter: (value: StatusFilter) => void
  selectedIds: Set<number>
  toggleTransaction: (transaction: TransactionRead) => void
}

interface StatusFilterHeaderProps {
  table: TanstackTable<TransactionRead>
}

interface LinkTransactionsTableProps {
  accounts: AccountRead[]
  selection: SelectedTransaction[]
  onSelectionChange: (selection: SelectedTransaction[]) => void
}

function StatusFilterHeader({ table }: StatusFilterHeaderProps) {
  const { statusFilter, setStatusFilter } = table.options
    .meta as TransactionsTableMeta

  return (
    <div className="flex items-center gap-1">
      Status
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="-my-2 size-6">
            <ListFilter
              className={cn(
                'size-3.5',
                statusFilter !== 'ALL' && 'text-primary'
              )}
            />
            <span className="sr-only">Filter status</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            {STATUS_FILTERS.map(({ value, label }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function LinkTransactionsTable({
  accounts,
  selection,
  onSelectionChange
}: LinkTransactionsTableProps) {
  const [selectedAccount, setSelectedAccount] = useState<AccountRead | null>(
    null
  )

  const currencyCode = selectedAccount?.currency_code

  const columns = useMemo<ColumnDef<TransactionRead>[]>(
    () => [
      {
        id: 'select',
        header: () => null,
        cell: ({ row, table }) => {
          const meta = table.options.meta as TransactionsTableMeta
          return (
            <Checkbox
              checked={meta.selectedIds.has(row.original.id)}
              onCheckedChange={() => meta.toggleTransaction(row.original)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Select transaction"
            />
          )
        }
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => formatDateTime(row.original.created_at)
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <Amount
            amount={parseFloat(row.original.amount)}
            currencyCode={currencyCode}
          />
        )
      },
      {
        accessorKey: 'status',
        header: ({ table }) => <StatusFilterHeader table={table} />,
        filterFn: 'equals',
        cell: ({ row }) => (
          <TransactionStatusBadge status={row.original.status} />
        )
      }
    ],
    [currencyCode]
  )

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | TransactionStatus
      | undefined) ?? 'ALL'

  const setStatusFilter = (value: StatusFilter) =>
    setColumnFilters((prev) => {
      const rest = prev.filter((filter) => filter.id !== 'status')
      return value === 'ALL' ? rest : [...rest, { id: 'status', value }]
    })

  const selectedIds = useMemo(
    () => new Set(selection.map((item) => item.transaction.id)),
    [selection]
  )

  const toggleTransaction = (transaction: TransactionRead) => {
    if (!selectedAccount) return
    onSelectionChange(
      selectedIds.has(transaction.id)
        ? selection.filter((item) => item.transaction.id !== transaction.id)
        : [...selection, { transaction, account: selectedAccount }]
    )
  }

  const { data } = useQuery({
    ...readTransactionsOptions({
      query: { account_id: selectedAccount?.id, event_id: 'empty' }
    }),
    enabled: selectedAccount !== null
  })

  // TanStack Table manages its own memoization; the React Compiler bail-out
  // for `useReactTable` is expected and safe here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data ?? EMPTY_TRANSACTIONS,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: { columnFilters },
    meta: {
      statusFilter,
      setStatusFilter,
      selectedIds,
      toggleTransaction
    } satisfies TransactionsTableMeta
  })

  return (
    <div className="space-y-3">
      <AccountSelect
        accounts={accounts}
        value={selectedAccount}
        onValueChange={setSelectedAccount}
      />

      <div className="min-h-66 rounded-md border">
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
                <TableRow
                  key={row.id}
                  data-state={
                    selectedIds.has(row.original.id) ? 'selected' : undefined
                  }
                  onClick={() => toggleTransaction(row.original)}
                  className="cursor-pointer"
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-66 text-center text-muted-foreground"
                >
                  No transactions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
