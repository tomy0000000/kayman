import { ChevronDownIcon } from 'lucide-react'

import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
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
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="group relative">
        <div
          aria-hidden
          className={cn(
            'flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm font-normal whitespace-nowrap transition-colors dark:bg-input/30',
            'group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="leading-none">{value ?? 'Currency'}</span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </div>
        <div
          className="absolute inset-0 opacity-0 [&_select]:h-full [&>div]:size-full"
          onClick={(e) => e.stopPropagation()}
        >
          <NativeSelect
            id={id}
            value={value ?? ''}
            onChange={(e) => {
              if (e.target.value) onValueChange(e.target.value)
            }}
          >
            <NativeSelectOption value="" hidden>
              Currency
            </NativeSelectOption>
            {currencies.map((currency) => (
              <NativeSelectOption key={currency.code} value={currency.code}>
                {currency.code} · {currency.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    )
  }

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
