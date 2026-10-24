import { Amount } from '@/components/amount'
import { TableCell, TableFooter, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface TableSubtotalProps {
  totals: Map<string, number>
  colSpan: number
  signed?: boolean
}

export function TableSubtotal({ totals, colSpan, signed }: TableSubtotalProps) {
  if (totals.size === 0) return null

  return (
    <TableFooter>
      <TableRow>
        <TableCell colSpan={colSpan}>
          <div className="flex items-baseline justify-between gap-4">
            <span>Subtotal</span>
            <div className="flex flex-col items-end tabular-nums">
              {[...totals].map(([currencyCode, total]) => (
                <span key={currencyCode} className="whitespace-nowrap">
                  {signed ? (
                    <Amount amount={total} currencyCode={currencyCode} />
                  ) : (
                    formatCurrency(total, currencyCode)
                  )}
                </span>
              ))}
            </div>
          </div>
        </TableCell>
      </TableRow>
    </TableFooter>
  )
}
