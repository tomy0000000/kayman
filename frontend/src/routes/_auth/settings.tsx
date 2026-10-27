import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { CurrencySelect } from '@/components/currency-select'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientCurrency } from '@/hooks/use-client-currency'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import type { VersionRead } from '@/lib/client'
import {
  readCurrenciesOptions,
  readVersionOptions
} from '@/lib/client/@tanstack/react-query.gen'
import {
  BROWSER_TIMEZONE,
  REFERENCE_STALE_TIME,
  REPO_URL
} from '@/lib/constants'

interface VersionRowProps {
  label: string
  version: VersionRead | undefined
  isPending?: boolean
}

const FRONTEND_VERSION: VersionRead = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__
}

export const Route = createFileRoute('/_auth/settings')({
  head: () => ({
    meta: [{ title: 'Settings · Kayman' }]
  }),
  component: SettingsPage
})

function SettingsPage() {
  const { timezone, isOverridden, setTimezone, reset } = useClientTimezone()
  const { currency, setCurrency, reset: resetCurrency } = useClientCurrency()
  const { data: currencies, isPending: currenciesPending } = useQuery({
    ...readCurrenciesOptions(),
    staleTime: REFERENCE_STALE_TIME
  })
  const { data: backendVersion, isPending: backendVersionPending } =
    useQuery(readVersionOptions())

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

      <Separator className="mt-8" />
      <h2 className="mt-6 text-sm font-semibold">About</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <VersionRow label="Frontend" version={FRONTEND_VERSION} />
        <VersionRow
          label="Backend"
          version={backendVersion}
          isPending={backendVersionPending}
        />
      </dl>
    </div>
  )
}

function VersionRow({ label, version, isPending = false }: VersionRowProps) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">
        {isPending ? (
          <Skeleton className="h-5 w-28" />
        ) : version === undefined ? (
          <span className="text-muted-foreground">Unavailable</span>
        ) : (
          <>
            {version.version}
            {version.commit && (
              <>
                {' · '}
                <a
                  href={`${REPO_URL}/commit/${version.commit}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {version.commit.slice(0, 7)}
                </a>
              </>
            )}
          </>
        )}
      </dd>
    </div>
  )
}
