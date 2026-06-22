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

interface TimePickerProps {
  id: string
  value: string
  onChange: (value: string) => void
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDatePart(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatTimePart(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function parseValue(value: string) {
  const [datePart, timePart = ''] = value.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  return { date: new Date(y, m - 1, d), time: timePart }
}

export function TimePicker({ id, value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const { date, time } = parseValue(value)

  return (
    <InputGroup>
      <InputGroupAddon className="flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton className="w-full justify-between">
              {format(date, 'PP')}
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
              selected={date}
              captionLayout="dropdown"
              defaultMonth={date}
              onSelect={(picked) => {
                if (!picked) return
                onChange(`${formatDatePart(picked)}T${time}`)
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
        onChange={(e) => onChange(`${formatDatePart(date)}T${e.target.value}`)}
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
            <DropdownMenuItem
              onSelect={() => {
                const now = new Date()
                onChange(`${formatDatePart(now)}T${formatTimePart(now)}`)
              }}
            >
              Now
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onChange(`${formatDatePart(date)}T00:00:00`)}
            >
              Midnight
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const [h = '00', m = '00'] = time.split(':')
                onChange(`${formatDatePart(date)}T${h}:${m}:00`)
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
