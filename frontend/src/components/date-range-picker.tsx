import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears
} from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { type DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, isSameRange } from '@/lib/utils'

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  setDateRange: (date: DateRange | undefined) => void
}

interface Preset {
  label: string
  getRange: () => DateRange
}

const PRESETS: Preset[] = [
  {
    label: 'Today',
    getRange: () => {
      const today = new Date()
      return { from: today, to: today }
    }
  },
  {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return { from: yesterday, to: yesterday }
    }
  },
  {
    label: 'Last 7 days',
    getRange: () => {
      const today = new Date()
      return { from: subDays(today, 6), to: today }
    }
  },
  {
    label: 'Last 30 days',
    getRange: () => {
      const today = new Date()
      return { from: subDays(today, 29), to: today }
    }
  },
  {
    label: 'Last 90 days',
    getRange: () => {
      const today = new Date()
      return { from: subDays(today, 89), to: today }
    }
  },
  {
    label: 'This week',
    getRange: () => {
      const today = new Date()
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 })
      }
    }
  },
  {
    label: 'Last week',
    getRange: () => {
      const lastWeek = subWeeks(new Date(), 1)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 })
      }
    }
  },
  {
    label: 'Month to date',
    getRange: () => {
      const today = new Date()
      return { from: startOfMonth(today), to: today }
    }
  },
  {
    label: 'This month',
    getRange: () => {
      const today = new Date()
      return { from: startOfMonth(today), to: endOfMonth(today) }
    }
  },
  {
    label: 'Last month',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1)
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
    }
  },
  {
    label: 'This quarter',
    getRange: () => {
      const today = new Date()
      return { from: startOfQuarter(today), to: endOfQuarter(today) }
    }
  },
  {
    label: 'Last quarter',
    getRange: () => {
      const lastQuarter = subQuarters(new Date(), 1)
      return {
        from: startOfQuarter(lastQuarter),
        to: endOfQuarter(lastQuarter)
      }
    }
  },
  {
    label: 'This year',
    getRange: () => {
      const today = new Date()
      return { from: startOfYear(today), to: endOfYear(today) }
    }
  },
  {
    label: 'Last year',
    getRange: () => {
      const lastYear = subYears(new Date(), 1)
      return { from: startOfYear(lastYear), to: endOfYear(lastYear) }
    }
  },
  {
    label: 'Year to date',
    getRange: () => {
      const today = new Date()
      return { from: startOfYear(today), to: today }
    }
  }
]

export function DatePickerWithRange({
  dateRange,
  setDateRange
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Field className="w-60 shrink-0">
      <FieldLabel htmlFor="date-picker-range">Date Range</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker-range"
            className="justify-start px-2.5 font-normal"
          >
            <CalendarIcon />
            {dateRange?.from ? (
              dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                <>
                  {format(dateRange.from, 'LLL dd, y')} -{' '}
                  {format(dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(dateRange.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="relative block w-auto p-0 pr-36"
          align="center"
        >
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
          />
          <ScrollArea className="absolute! inset-y-0 right-0 w-36 border-l">
            <div className="flex flex-col gap-0.5 p-2">
              {PRESETS.map((preset) => {
                const range = preset.getRange()
                const active = isSameRange(dateRange, range)
                return (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'justify-start font-normal',
                      active && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => {
                      setDateRange(range)
                      setOpen(false)
                    }}
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </Field>
  )
}
