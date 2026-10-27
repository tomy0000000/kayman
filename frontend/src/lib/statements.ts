import { addDays, addMonths, endOfMonth, startOfMonth, subDays } from 'date-fns'

import { type AccountType, type StatementRead } from '@/lib/client'
import { formatCalendarDate, negateDecimal, parseLocalDate } from '@/lib/utils'

const DUE_DAYS_AFTER_PERIOD_END = 15

export interface StatementCycle {
  periodStartOn: string
  periodEndOn: string
  dueOn: string
}

// Card issuers print what you owe as positive, so the sign flips both ways.
export function issuerBalance(
  balance: string,
  accountType: AccountType
): string {
  return accountType === 'CREDIT_CARD' ? negateDecimal(balance) : balance
}

export function latestStatement(
  statements: StatementRead[]
): StatementRead | undefined {
  return statements.reduce<StatementRead | undefined>(
    (latest, statement) =>
      latest && latest.period_end_on >= statement.period_end_on
        ? latest
        : statement,
    undefined
  )
}

// The latest statement whose period ends before `statement`'s starts.
export function previousStatement(
  statements: StatementRead[],
  statement: StatementRead
): StatementRead | undefined {
  return latestStatement(
    statements.filter(
      (other) => other.period_end_on < statement.period_start_on
    )
  )
}

// The statement whose period covers `day`, a "YYYY-MM-DD" calendar day.
export function statementForDay(
  statements: StatementRead[],
  day: string
): StatementRead | undefined {
  return statements.find(
    (statement) =>
      statement.period_start_on <= day && day <= statement.period_end_on
  )
}

// The cycle following the account's latest statement, or the current month when
// it has none yet. `today` is a `zonedCalendarDate` stand-in, so the fallback
// month is the client's, not the browser's.
export function nextStatementCycle(
  statements: StatementRead[],
  today: Date
): StatementCycle {
  const latest = latestStatement(statements)
  const start = latest
    ? addDays(parseLocalDate(latest.period_end_on), 1)
    : startOfMonth(today)
  const end = latest ? subDays(addMonths(start, 1), 1) : endOfMonth(today)

  return {
    periodStartOn: formatCalendarDate(start),
    periodEndOn: formatCalendarDate(end),
    dueOn: formatCalendarDate(addDays(end, DUE_DAYS_AFTER_PERIOD_END))
  }
}
