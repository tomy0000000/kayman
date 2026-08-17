import { addDays, format, isSameMonth } from 'date-fns'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { type ComponentProps, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatCalendarDate } from '@/lib/utils'

interface ResponsiveCalendarProps {
  date: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  month: Date
  onMonthChange: (month: Date) => void
  eventDays: Set<string>
}

type EventDayButtonProps = ComponentProps<typeof CalendarDayButton>

export function ResponsiveCalendar({
  date,
  onDateSelect,
  month,
  onMonthChange,
  eventDays
}: ResponsiveCalendarProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const hasEvent = (day: Date) => eventDays.has(formatCalendarDate(day))

  const stepDay = (amount: number) => {
    if (!date) return
    const next = addDays(date, amount)
    onDateSelect(next)
    if (!isSameMonth(next, month)) onMonthChange(next)
  }

  if (isMobile) {
    return (
      <ButtonGroup className="w-full">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          disabled={!date}
          onClick={() => stepDay(-1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 justify-start px-2.5 font-normal"
            >
              <CalendarIcon />
              {date ? format(date, 'LLL dd, y') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(next) => {
                onDateSelect(next)
                setOpen(false)
              }}
              month={month}
              onMonthChange={onMonthChange}
              modifiers={{ hasEvent }}
              components={{ DayButton: EventDayButton }}
              fixedWeeks
              captionLayout="dropdown"
              className="[--cell-size:--spacing(9.5)]"
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={!date}
          onClick={() => stepDay(1)}
        >
          <ChevronRightIcon />
        </Button>
      </ButtonGroup>
    )
  }

  return (
    <Card className="mx-auto" size="sm">
      <CardContent>
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateSelect}
          month={month}
          onMonthChange={onMonthChange}
          modifiers={{ hasEvent }}
          components={{ DayButton: EventDayButton }}
          fixedWeeks
          captionLayout="dropdown"
          className="p-0 [--cell-size:--spacing(9.5)]"
        />
      </CardContent>
    </Card>
  )
}

// The day cell plus a dot for days that hold an event. The dot is absolute so it
// sits under the centered day number instead of shifting it, and `bg-current`
// keeps it legible on the selected day's inverted colors.
function EventDayButton({ children, ...props }: EventDayButtonProps) {
  return (
    <CalendarDayButton {...props}>
      {children}
      {props.modifiers.hasEvent && (
        <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />
      )}
    </CalendarDayButton>
  )
}
