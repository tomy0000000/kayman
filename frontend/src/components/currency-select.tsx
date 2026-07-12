import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { type CurrencyRead } from '@/lib/client'

interface CurrencySelectProps {
  currencies: CurrencyRead[]
  value: string | null
  onValueChange: (code: string) => void
  id?: string
}

export function CurrencySelect({
  currencies,
  value,
  onValueChange,
  id
}: CurrencySelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between px-2 font-normal"
        >
          {value ?? <span className="text-muted-foreground">Currency</span>}
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {currencies.map((currency) => (
          <DropdownMenuItem
            key={currency.code}
            onSelect={() => onValueChange(currency.code)}
          >
            <span className="leading-none">{currency.code}</span>
            <span className="text-muted-foreground ml-auto text-xs leading-none">
              {currency.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
