import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'

interface ResponsiveCalendarProps {
  date: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  month: Date
  onMonthChange: (month: Date) => void
}

export function ResponsiveCalendar({
  date,
  onDateSelect,
  month,
  onMonthChange
}: ResponsiveCalendarProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start px-2.5 font-normal"
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
            fixedWeeks
            captionLayout="dropdown"
            className="[--cell-size:--spacing(9.5)]"
          />
        </PopoverContent>
      </Popover>
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
          fixedWeeks
          captionLayout="dropdown"
          className="p-0 [--cell-size:--spacing(9.5)]"
        />
      </CardContent>
    </Card>
  )
}
