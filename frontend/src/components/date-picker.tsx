import { format } from 'date-fns'
import { CalendarIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { formatCalendarDate, parseLocalDate } from '@/lib/utils'

interface DatePickerProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  min?: string
  invalid?: boolean
  clearable?: boolean
}

export function DatePicker({
  id,
  value,
  onValueChange,
  min,
  invalid,
  clearable
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selected = value ? parseLocalDate(value) : undefined

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          id={id}
          aria-invalid={invalid}
          className="w-full shrink justify-start px-2.5 font-normal"
        >
          <CalendarIcon />
          {selected ? format(selected, 'LLL dd, y') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          defaultMonth={selected}
          selected={selected}
          onSelect={(picked) => {
            if (!picked) return
            onValueChange(formatCalendarDate(picked))
            setOpen(false)
          }}
          disabled={min ? { before: parseLocalDate(min) } : undefined}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  )

  if (!clearable) return picker

  return (
    <ButtonGroup className="w-full">
      {picker}
      {selected && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Clear date"
          onClick={() => {
            onValueChange('')
            triggerRef.current?.focus()
          }}
        >
          <XIcon />
        </Button>
      )}
    </ButtonGroup>
  )
}
