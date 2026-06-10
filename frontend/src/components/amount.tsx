import { cn, formatCurrency } from '@/lib/utils'

interface AmountProps extends React.ComponentProps<'span'> {
  amount: number
  currencyCode?: string
}

function Amount({ amount, currencyCode, className, ...props }: AmountProps) {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  const absAmount = Math.abs(amount)
  const formatted = currencyCode
    ? formatCurrency(absAmount, currencyCode)
    : absAmount

  return (
    <span
      data-slot="amount"
      className={cn(
        amount > 0 && 'text-green-600',
        amount < 0 && 'text-red-600',
        className
      )}
      {...props}
    >
      {sign}
      {formatted}
    </span>
  )
}

export { Amount }
