import { differenceInCalendarDays } from 'date-fns'
import { useState } from 'react'
import { type DateRange } from 'react-day-picker'

import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { DatePicker } from '@/components/date-picker'
import { DatePickerWithRange } from '@/components/date-range-picker'
import { KbdForm } from '@/components/kbd-form'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@/components/ui/field'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import {
  type CurrencyRead,
  type StatementCreate,
  type StatementRead
} from '@/lib/client'
import { latestStatement, nextStatementCycle } from '@/lib/statements'
import {
  formatCalendarDate,
  formatPlainDate,
  isAmount,
  parseLocalDate,
  pluralize,
  zonedCalendarDate
} from '@/lib/utils'

interface CreateStatementFormProps {
  accountId: number
  currency: CurrencyRead | undefined
  statements: StatementRead[]
  onSubmit: (body: StatementCreate) => void
  isPending: boolean
}

export function CreateStatementForm({
  accountId,
  currency,
  statements,
  onSubmit,
  isPending
}: CreateStatementFormProps) {
  const { timezone } = useClientTimezone()

  const [cycle] = useState(() =>
    nextStatementCycle(statements, zonedCalendarDate(new Date(), timezone))
  )
  const [periodStartOn, setPeriodStartOn] = useState(cycle.periodStartOn)
  const [periodEndOn, setPeriodEndOn] = useState(cycle.periodEndOn)
  const [dueOn, setDueOn] = useState(cycle.dueOn)
  const [balance, setBalance] = useState('')

  const previous = latestStatement(statements)

  const periodRange: DateRange | undefined = periodStartOn
    ? {
        from: parseLocalDate(periodStartOn),
        to: periodEndOn ? parseLocalDate(periodEndOn) : undefined
      }
    : undefined

  const handleRangeChange = (range: DateRange | undefined) => {
    setPeriodStartOn(range?.from ? formatCalendarDate(range.from) : '')
    setPeriodEndOn(range?.to ? formatCalendarDate(range.to) : '')
  }

  // Reachable by moving the period end past an already-picked due date, which
  // the calendar's `min` cannot prevent.
  const isDueBeforePeriodEnd =
    dueOn !== '' && periodEndOn !== '' && dueOn < periodEndOn

  // Both are "YYYY-MM-DD", so lexicographic order is chronological order. These
  // mirror the backend's validators, which would otherwise 422 on submit.
  const isValid =
    periodStartOn !== '' &&
    periodEndOn !== '' &&
    dueOn !== '' &&
    isAmount(balance) &&
    periodStartOn <= periodEndOn &&
    dueOn >= periodEndOn

  const dueDays =
    dueOn !== '' && periodEndOn !== ''
      ? differenceInCalendarDays(
          parseLocalDate(dueOn),
          parseLocalDate(periodEndOn)
        )
      : null

  const handleCreate = () =>
    onSubmit({
      account_id: accountId,
      period_start_on: periodStartOn,
      period_end_on: periodEndOn,
      due_on: dueOn,
      balance
    })

  return (
    <KbdForm onSubmit={handleCreate} isPending={isPending} disabled={!isValid}>
      <DatePickerWithRange
        id="statement-period"
        label="Period"
        className="w-full"
        showPresets={false}
        dateRange={periodRange}
        setDateRange={handleRangeChange}
        description={
          previous &&
          `Follows ${formatPlainDate(previous.period_end_on)}, the last statement's period end.`
        }
      />

      <Field>
        <FieldLabel htmlFor="statement-balance">Balance</FieldLabel>
        <CurrencyAmountInput
          id="statement-balance"
          amount={balance}
          onAmountChange={setBalance}
          currency={currency}
          required
        />
      </Field>

      <Field data-invalid={isDueBeforePeriodEnd}>
        <FieldLabel htmlFor="statement-due">Due date</FieldLabel>
        <DatePicker
          id="statement-due"
          value={dueOn}
          onValueChange={setDueOn}
          min={periodEndOn || undefined}
          invalid={isDueBeforePeriodEnd}
        />
        {isDueBeforePeriodEnd ? (
          <FieldError>
            Due date must be on or after the period end,{' '}
            {formatPlainDate(periodEndOn)}.
          </FieldError>
        ) : (
          dueDays !== null &&
          dueDays > 0 && (
            <FieldDescription>
              {pluralize(dueDays, 'day', 'days')} after period end
            </FieldDescription>
          )
        )}
      </Field>
    </KbdForm>
  )
}
