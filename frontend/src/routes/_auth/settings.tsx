import { createFileRoute } from '@tanstack/react-router'

import { TimezoneCombobox } from '@/components/timezone-combobox'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { BROWSER_TIMEZONE } from '@/lib/constants'

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage
})

function SettingsPage() {
  const { timezone, isOverridden, setTimezone, reset } = useClientTimezone()

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
    </div>
  )
}
