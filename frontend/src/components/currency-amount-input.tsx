import { CurrencySelect } from '@/components/currency-select'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from '@/components/ui/input-group'
import { type CurrencyRead } from '@/lib/client'

interface CurrencyAmountInputProps {
  currencies: CurrencyRead[]
  currencyCode: string | null
  onCurrencyChange: (code: string) => void
  amount: string
  onAmountChange: (amount: string) => void
  id?: string
}

export function CurrencyAmountInput({
  currencies,
  currencyCode,
  onCurrencyChange,
  amount,
  onAmountChange,
  id
}: CurrencyAmountInputProps) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <CurrencySelect
          currencies={currencies}
          value={currencyCode}
          onValueChange={onCurrencyChange}
          className="h-6 w-auto rounded-[calc(var(--radius)-3px)] border-0 bg-transparent px-1.5 text-muted-foreground hover:bg-accent dark:bg-transparent dark:hover:bg-transparent"
        />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="text"
        inputMode="text"
        pattern="-?[0-9]*\.?[0-9]*"
        autoComplete="off"
        placeholder="0.00"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
      />
    </InputGroup>
  )
}
