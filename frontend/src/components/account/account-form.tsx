import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { KbdForm } from '@/components/kbd-form'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { ACCOUNT_TYPES } from '@/lib/account-types'
import {
  type AccountCreate,
  type AccountRead,
  type AccountType,
  type CurrencyRead
} from '@/lib/client'

interface AccountFormProps {
  currencies: CurrencyRead[]
  editingAccount: AccountRead | null
  onSubmit: (body: AccountCreate) => void
  isPending: boolean
}

export function AccountForm({
  currencies,
  editingAccount,
  onSubmit,
  isPending
}: AccountFormProps) {
  const { timezone: clientTimezone } = useClientTimezone()
  const [name, setName] = useState(editingAccount?.name ?? '')
  const [shortName, setShortName] = useState(editingAccount?.short_name ?? '')
  const [type, setType] = useState<AccountType>(editingAccount?.type ?? 'CASH')
  const [currencyCode, setCurrencyCode] = useState<string | null>(
    editingAccount?.currency_code ?? null
  )
  const [timezone, setTimezone] = useState<string>(
    editingAccount?.timezone ?? clientTimezone
  )

  // Currency and timezone are fixed once the account exists.
  const isEditing = editingAccount != null

  const selectedCurrency = currencies.find((c) => c.code === currencyCode)

  const handleSubmit = () => {
    if (currencyCode == null) return
    onSubmit({
      name,
      short_name: shortName || null,
      type,
      currency_code: currencyCode,
      timezone: timezone as AccountCreate['timezone']
    })
  }

  return (
    <KbdForm
      onSubmit={handleSubmit}
      isPending={isPending}
      isEditing={isEditing}
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
        <FieldLabel>Type</FieldLabel>
        <Tabs
          value={type}
          onValueChange={(value) => setType(value as AccountType)}
        >
          <TabsList className="w-full">
            {ACCOUNT_TYPES.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-1 px-1 text-xs"
              >
                <Icon />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
              disabled={isEditing}
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
          disabled={isEditing}
        />
        {!isEditing && (
          <FieldDescription>Will be stored as {timezone}</FieldDescription>
        )}
      </Field>

      {/* Opened when editing, so an existing short name is not hidden. */}
      <Collapsible
        className="space-y-5"
        defaultOpen={editingAccount?.short_name != null}
      >
        <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Advanced
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5">
          <Field>
            <FieldLabel htmlFor="account-short-name">Short name</FieldLabel>
            <Input
              id="account-short-name"
              placeholder="Optional"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
            />
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </KbdForm>
  )
}
