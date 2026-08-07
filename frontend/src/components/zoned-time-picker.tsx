import { TimePicker } from '@/components/time-picker'
import { FieldDescription } from '@/components/ui/field'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { formatZonedDateTime, toZonedISOString } from '@/lib/utils'

interface ZonedTimePickerProps {
  id: string
  value: Date
  timezone: string
  onChange: (value: string) => void
}

export function ZonedTimePicker({
  id,
  value,
  timezone,
  onChange
}: ZonedTimePickerProps) {
  const { timezone: clientTimezone } = useClientTimezone()

  return (
    <>
      <TimePicker
        id={id}
        value={value}
        timezone={clientTimezone}
        onChange={(next) => onChange(toZonedISOString(next, timezone))}
      />
      {timezone !== clientTimezone && (
        <FieldDescription>
          {`= ${formatZonedDateTime(value, timezone)} in ${timezone}`}
        </FieldDescription>
      )}
    </>
  )
}
