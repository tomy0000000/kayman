import { CurrencySelect } from '@/components/currency-select'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { type CurrencyRead } from '@/lib/client'

interface CurrencyAmountInputProps {
  amount: string
  onAmountChange: (amount: string) => void
  currency: CurrencyRead | null | undefined
  currencies?: CurrencyRead[]
  onCurrencyChange?: (code: string) => void
  required?: boolean
  id?: string
}

export function CurrencyAmountInput({
  amount,
  onAmountChange,
  currency,
  currencies,
  onCurrencyChange,
  required,
  id
}: CurrencyAmountInputProps) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>{currency?.symbol}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="number"
        pattern="-?[0-9]*\.?[0-9]*"
        autoComplete="off"
        placeholder="0.00"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        required={required}
      />
      <InputGroupAddon align="inline-end">
        {currencies && onCurrencyChange ? (
          <CurrencySelect
            currencies={currencies}
            value={currency?.code ?? null}
            onValueChange={onCurrencyChange}
            className="h-6 w-auto rounded-[calc(var(--radius)-3px)] border-0 bg-transparent px-1.5 text-muted-foreground hover:bg-accent dark:bg-transparent dark:hover:bg-transparent"
          />
        ) : (
          <InputGroupText>{currency?.code}</InputGroupText>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
