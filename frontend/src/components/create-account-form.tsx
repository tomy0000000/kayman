import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { KbdForm } from '@/components/kbd-form'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { type AccountCreate, type CurrencyRead } from '@/lib/client'
import { CLIENT_TIMEZONE } from '@/lib/constants'

interface CreateAccountFormProps {
  currencies: CurrencyRead[]
  onSubmit: (body: AccountCreate) => void
  isPending: boolean
}

export function CreateAccountForm({
  currencies,
  onSubmit,
  isPending
}: CreateAccountFormProps) {
  const [name, setName] = useState('')
  const [currencyCode, setCurrencyCode] = useState<string | null>(null)
  const [timezone, setTimezone] = useState(CLIENT_TIMEZONE)

  const selectedCurrency = currencies.find((c) => c.code === currencyCode)

  const handleCreate = () => {
    if (currencyCode == null) return
    onSubmit({
      name,
      currency_code: currencyCode,
      timezone: timezone as AccountCreate['timezone']
    })
  }

  return (
    <KbdForm
      onSubmit={handleCreate}
      isPending={isPending}
      disabled={!name || currencyCode == null}
    >
      <Field>
        <FieldLabel htmlFor="account-name">Name</FieldLabel>
        <Input
          id="account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="account-currency">Currency</FieldLabel>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id="account-currency"
              type="button"
              variant="outline"
              className="w-full justify-between"
            >
              {selectedCurrency ? (
                <span className="flex items-center gap-2">
                  <span className="font-medium">{selectedCurrency.code}</span>
                  <span className="text-muted-foreground text-xs">
                    {selectedCurrency.name}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select currency</span>
              )}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto"
          >
            {currencies.map((currency) => (
              <DropdownMenuItem
                key={currency.code}
                onSelect={() => setCurrencyCode(currency.code)}
              >
                <span className="leading-none">{currency.code}</span>
                <span className="text-muted-foreground ml-auto text-xs leading-none">
                  {currency.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Field>

      <Field>
        <FieldLabel htmlFor="account-timezone">Timezone</FieldLabel>
        <TimezoneCombobox
          id="account-timezone"
          value={timezone}
          onValueChange={setTimezone}
        />
        <FieldDescription>Will be stored as {timezone}</FieldDescription>
      </Field>
    </KbdForm>
  )
}
