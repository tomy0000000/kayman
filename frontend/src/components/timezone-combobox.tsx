import { Globe } from 'lucide-react'

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  useComboboxAnchor
} from '@/components/ui/combobox'
import { InputGroupAddon } from '@/components/ui/input-group'
import { gmtLabel, offsetMinutes } from '@/lib/utils'

interface TimezoneOption {
  value: string
  label: string
}

interface TimezoneGroup {
  value: string
  items: TimezoneOption[]
}

// Grouped by IANA area ("America", "Europe", ...), each option labelled
// e.g. "America/New_York" -> "(GMT-5) New York" under the "America" group.
const TIMEZONE_GROUPS: TimezoneGroup[] = (() => {
  const byArea = new Map<string, (TimezoneOption & { offset: number })[]>()
  for (const tz of Intl.supportedValuesOf('timeZone')) {
    const area = tz.split('/')[0]
    const gmt = gmtLabel(tz)
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
    const items = byArea.get(area) ?? []
    items.push({
      value: tz,
      label: `(${gmt}) ${city}`,
      offset: offsetMinutes(gmt)
    })
    byArea.set(area, items)
  }
  return [...byArea.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([area, items]) => ({
      value: area,
      items: items
        .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label))
        .map(({ value, label }) => ({ value, label }))
    }))
})()

const TIMEZONE_OPTIONS = TIMEZONE_GROUPS.flatMap((group) => group.items)

interface TimezoneComboboxProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
}

export function TimezoneCombobox({
  id,
  value,
  onValueChange
}: TimezoneComboboxProps) {
  const anchor = useComboboxAnchor()
  const selected = TIMEZONE_OPTIONS.find((tz) => tz.value === value) ?? null

  return (
    <Combobox
      id={id}
      items={TIMEZONE_GROUPS}
      value={selected}
      onValueChange={(option) => onValueChange(option?.value ?? '')}
    >
      <div ref={anchor}>
        <ComboboxInput placeholder="Select timezone">
          <InputGroupAddon>
            <Globe className="size-4" />
          </InputGroupAddon>
        </ComboboxInput>
      </div>
      <ComboboxContent anchor={anchor} className="min-w-0">
        <ComboboxEmpty>No timezone found.</ComboboxEmpty>
        <ComboboxList>
          {(group: TimezoneGroup, index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(tz: TimezoneOption) => (
                  <ComboboxItem key={tz.value} value={tz}>
                    {tz.label}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
              {index < TIMEZONE_GROUPS.length - 1 && <ComboboxSeparator />}
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
