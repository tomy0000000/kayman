import { format } from 'date-fns'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { formatTimePart, withDate, withTime } from '@/lib/utils'

interface TimePickerProps {
  id: string
  value: Date
  onChange: (value: Date) => void
}

export function TimePicker({ id, value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const time = formatTimePart(value)

  return (
    <InputGroup>
      <InputGroupAddon className="flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton className="w-full justify-between">
              {format(value, 'PP')}
              <ChevronDownIcon />
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            <Calendar
              mode="single"
              selected={value}
              captionLayout="dropdown"
              defaultMonth={value}
              onSelect={(picked) => {
                if (!picked) return
                onChange(withDate(value, picked))
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
      <InputGroupInput
        type="time"
        id={id}
        step="1"
        value={time}
        onChange={(e) => onChange(withTime(value, e.target.value))}
        required
        className="[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
      <InputGroupAddon align="inline-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <InputGroupButton aria-label="Time presets">
              <ChevronDownIcon />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onChange(new Date())}>
              Now
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onChange(withTime(value, '00:00:00'))}
            >
              Midnight
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const [h = '00', m = '00'] = time.split(':')
                onChange(withTime(value, `${h}:${m}:00`))
              }}
            >
              :00 second
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  )
}
