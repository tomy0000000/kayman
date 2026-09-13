import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
}

export function DatePicker({
  id,
  value,
  onValueChange,
  min,
  invalid
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const selected = value ? parseLocalDate(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id={id}
          aria-invalid={invalid}
          className="w-full justify-start px-2.5 font-normal"
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
}
