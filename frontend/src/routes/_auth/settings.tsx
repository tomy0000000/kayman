import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { CurrencySelect } from '@/components/currency-select'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientCurrency } from '@/hooks/use-client-currency'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { readCurrenciesOptions } from '@/lib/client/@tanstack/react-query.gen'
import { BROWSER_TIMEZONE, REFERENCE_STALE_TIME } from '@/lib/constants'

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage
})

function SettingsPage() {
  const { timezone, isOverridden, setTimezone, reset } = useClientTimezone()
  const { currency, setCurrency, reset: resetCurrency } = useClientCurrency()
  const { data: currencies, isPending: currenciesPending } = useQuery({
    ...readCurrenciesOptions(),
    staleTime: REFERENCE_STALE_TIME
  })

  return (
    <div className="w-full max-w-md p-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Field className="mt-6">
        <FieldLabel htmlFor="client-timezone">Timezone</FieldLabel>
        <TimezoneCombobox
          id="client-timezone"
          value={timezone}
          onValueChange={setTimezone}
        />
        <FieldDescription>
          {isOverridden
            ? `Overriding your browser timezone (${BROWSER_TIMEZONE}).`
            : 'Using your browser timezone.'}
        </FieldDescription>
      </Field>

      {isOverridden && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={reset}
        >
          Reset to browser timezone
        </Button>
      )}

      <Field className="mt-6">
        <FieldLabel htmlFor="client-currency">Currency</FieldLabel>
        {currenciesPending ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <CurrencySelect
            id="client-currency"
            currencies={currencies ?? []}
            value={currency}
            onValueChange={setCurrency}
          />
        )}
        <FieldDescription>
          Used as the default for new entries.
        </FieldDescription>
      </Field>

      {currency !== null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={resetCurrency}
        >
          Clear default currency
        </Button>
      )}
    </div>
  )
}
