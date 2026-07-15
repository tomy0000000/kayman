import { TimePicker } from '@/components/time-picker'
import { FieldDescription } from '@/components/ui/field'
import { CLIENT_TIMEZONE } from '@/lib/constants'
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
  return (
    <>
      <TimePicker
        id={id}
        value={value}
        onChange={(next) => onChange(toZonedISOString(next, timezone))}
      />
      {timezone !== CLIENT_TIMEZONE && (
        <FieldDescription>
          {`= ${formatZonedDateTime(value, timezone)} in ${timezone}`}
        </FieldDescription>
      )}
    </>
  )
}
