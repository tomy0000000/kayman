import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Globe } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FabSheet } from '@/components/fab-sheet'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor
} from '@/components/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroupAddon } from '@/components/ui/input-group'
import { SheetFooter } from '@/components/ui/sheet'
import {
  type AccountCreate,
  type AccountRead,
  createAccount,
  readCurrencies
} from '@/lib/client'
import type { Client } from '@/lib/client/client'

const TIMEZONES = Intl.supportedValuesOf('timeZone')

interface CreateAccountFabProps {
  client: Client
}

export function CreateAccountFab({ client }: CreateAccountFabProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [currencyCode, setCurrencyCode] = useState<string | null>(null)
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const timezoneAnchor = useComboboxAnchor()

  const { data: currencies } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const response = await readCurrencies({ client })
      if (response.error) throw new Error('Failed to fetch currencies')
      if (!response.data) throw new Error('No data returned')
      return response.data
    },
    enabled: open
  })

  const selectedCurrency = currencies?.find((c) => c.code === currencyCode)

  const reset = () => {
    setName('')
    setCurrencyCode(null)
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: AccountCreate) => {
      const response = await createAccount({ client, body })
      if (response.error) throw new Error('Failed to create account')
      if (!response.data) throw new Error('No data returned')
      return response.data as AccountRead
    },
    onSuccess: () => {
      toast.success('Account created')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      reset()
      setOpen(false)
    },
    onError: (error) => {
      console.error(error)
      toast.error('Failed to create account', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (currencyCode == null) return
    mutate({
      name,
      currency_code: currencyCode,
      timezone: timezone as AccountCreate['timezone']
    })
  }

  return (
    <FabSheet open={open} onOpenChange={setOpen} hotkey="n" label="New account">
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <FieldGroup className="flex-1 overflow-y-auto px-4">
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
                      <span className="font-medium">
                        {selectedCurrency.code}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {selectedCurrency.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Select currency
                    </span>
                  )}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto"
              >
                {currencies?.map((currency) => (
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
            <Combobox
              id="account-timezone"
              items={TIMEZONES}
              value={timezone}
              onValueChange={(value) => setTimezone(value ?? '')}
            >
              <div ref={timezoneAnchor}>
                <ComboboxInput placeholder="Select timezone">
                  <InputGroupAddon>
                    <Globe className="size-4" />
                  </InputGroupAddon>
                </ComboboxInput>
              </div>
              <ComboboxContent anchor={timezoneAnchor} className="min-w-0">
                <ComboboxEmpty>No timezone found.</ComboboxEmpty>
                <ComboboxList>
                  {(tz: string) => (
                    <ComboboxItem key={tz} value={tz}>
                      {tz}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </FieldGroup>

        <SheetFooter>
          <Button
            type="submit"
            disabled={isPending || !name || currencyCode == null}
          >
            {isPending ? 'Creating...' : 'Create'}
          </Button>
        </SheetFooter>
      </form>
    </FabSheet>
  )
}
