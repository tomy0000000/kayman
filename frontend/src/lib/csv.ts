import type { EventReadDetailed } from '@/lib/client'

const EVENT_CSV_HEADER = [
  'Event ID',
  'Type',
  'Timestamp',
  'Event description',
  'Section',
  'Name',
  'Line description',
  'Quantity',
  'Unit amount',
  'Total',
  'Currency',
  'Status',
  'Tags'
]

// One flat table rather than the receipt's two sections, and the event columns
// repeat on every row, so a single file opens as a spreadsheet and several
// exports can be stacked.
export function eventToCsv(
  event: EventReadDetailed,
  categoryNames: Map<number, string>,
  accountNames: Map<number, string>
): string {
  const eventColumns = [
    String(event.id),
    event.type,
    event.timestamp,
    event.description ?? ''
  ]

  const entryRows = event.entries.map((entry) => [
    ...eventColumns,
    'Entry',
    categoryNames.get(entry.category_id) ?? `#${entry.category_id}`,
    entry.description ?? '',
    String(entry.quantity),
    entry.amount,
    String(Number(entry.amount) * entry.quantity),
    entry.currency_code,
    '',
    ''
  ])

  const transactionRows = event.transactions.map((transaction) => [
    ...eventColumns,
    'Transaction',
    accountNames.get(transaction.account_id) ?? `#${transaction.account_id}`,
    transaction.description ?? '',
    '1',
    transaction.amount,
    transaction.amount,
    transaction.currency_code,
    transaction.status,
    (transaction.tags ?? []).map((tag) => tag.name).join(' ')
  ])

  return [EVENT_CSV_HEADER, ...entryRows, ...transactionRows]
    .map((row) => row.map(escapeField).join(','))
    .join('\r\n')
}

// Excel reads a BOM-less UTF-8 file as the local codepage, which mangles any
// non-ASCII category or seller name.
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Deferred: Firefox cancels the download if the URL is revoked in the same
  // tick as the click.
  setTimeout(() => URL.revokeObjectURL(url))
}

function escapeField(value: string): string {
  return /["\n\r,]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}
