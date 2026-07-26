import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { type CurrencyRead } from '@/lib/client'
import { cn } from '@/lib/utils'

interface CurrencySelectProps {
  currencies: CurrencyRead[]
  value: string | null
  onValueChange: (code: string) => void
  id?: string
  className?: string
}

export function CurrencySelect({
  currencies,
  value,
  onValueChange,
  id,
  className
}: CurrencySelectProps) {
  return (
    <Select value={value ?? ''} onValueChange={onValueChange}>
      <SelectTrigger id={id} className={cn('w-full font-normal', className)}>
        <SelectValue placeholder="Currency">{value}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-72">
        {currencies.map((currency) => (
          <SelectItem
            key={currency.code}
            value={currency.code}
            className="[&>span:last-child]:w-full"
          >
            <span className="leading-none">{currency.code}</span>
            <span className="ml-auto text-xs leading-none text-muted-foreground">
              {currency.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
