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
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { cn, isSameRange, zonedCalendarDate } from '@/lib/utils'

interface DatePickerWithRangeProps {
  dateRange: DateRange | undefined
  setDateRange: (date: DateRange | undefined) => void
}

interface Preset {
  label: string
  getRange: (today: Date) => DateRange
}

const PRESETS: Preset[] = [
  {
    label: 'Today',
    getRange: (today) => ({ from: today, to: today })
  },
  {
    label: 'Yesterday',
    getRange: (today) => {
      const yesterday = subDays(today, 1)
      return { from: yesterday, to: yesterday }
    }
  },
  {
    label: 'Last 7 days',
    getRange: (today) => ({ from: subDays(today, 6), to: today })
  },
  {
    label: 'Last 30 days',
    getRange: (today) => ({ from: subDays(today, 29), to: today })
  },
  {
    label: 'Last 90 days',
    getRange: (today) => ({ from: subDays(today, 89), to: today })
  },
  {
    label: 'This week',
    getRange: (today) => ({
      from: startOfWeek(today, { weekStartsOn: 1 }),
      to: endOfWeek(today, { weekStartsOn: 1 })
    })
  },
  {
    label: 'Last week',
    getRange: (today) => {
      const lastWeek = subWeeks(today, 1)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 })
      }
    }
  },
  {
    label: 'Month to date',
    getRange: (today) => ({ from: startOfMonth(today), to: today })
  },
  {
    label: 'This month',
    getRange: (today) => ({
      from: startOfMonth(today),
      to: endOfMonth(today)
    })
  },
  {
    label: 'Last month',
    getRange: (today) => {
      const lastMonth = subMonths(today, 1)
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
    }
  },
  {
    label: 'This quarter',
    getRange: (today) => ({
      from: startOfQuarter(today),
      to: endOfQuarter(today)
    })
  },
  {
    label: 'Last quarter',
    getRange: (today) => {
      const lastQuarter = subQuarters(today, 1)
      return {
        from: startOfQuarter(lastQuarter),
        to: endOfQuarter(lastQuarter)
      }
    }
  },
  {
    label: 'This year',
    getRange: (today) => ({
      from: startOfYear(today),
      to: endOfYear(today)
    })
  },
  {
    label: 'Last year',
    getRange: (today) => {
      const lastYear = subYears(today, 1)
      return { from: startOfYear(lastYear), to: endOfYear(lastYear) }
    }
  },
  {
    label: 'Year to date',
    getRange: (today) => ({ from: startOfYear(today), to: today })
  }
]

export function DatePickerWithRange({
  dateRange,
  setDateRange
}: DatePickerWithRangeProps) {
  const { timezone } = useClientTimezone()
  const [open, setOpen] = useState(false)

  const today = zonedCalendarDate(new Date(), timezone)

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
                const range = preset.getRange(today)
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
