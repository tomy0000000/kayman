import {
  ArrowLeftRight,
  type LucideIcon,
  Repeat,
  TrendingDown,
  TrendingUp
} from 'lucide-react'

import { type EventType } from '@/lib/client'

// The API spells the enum in UPPER_SNAKE_CASE, so the display label lives
// here and nowhere else. Ordered as the event form's type tabs render them.
export const EVENT_TYPES: {
  value: EventType
  label: string
  icon: LucideIcon
}[] = [
  { value: 'EXPENSE', label: 'Expense', icon: TrendingDown },
  { value: 'INCOME', label: 'Income', icon: TrendingUp },
  { value: 'TRANSFER', label: 'Transfer', icon: ArrowLeftRight },
  { value: 'EXCHANGE', label: 'Exchange', icon: Repeat }
]

export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPES.find(({ value }) => value === type)?.label ?? type
}

// Semantic color per event type, shared by the create-event tabs and the
// event-type badge so the palette lives in one place. Tailwind only detects
// class names written out literally, so the plain badge form and the
// `data-active:` tab form are listed side by side rather than derived.

export const eventTypeBadgeClass: Record<EventType, string> = {
  EXPENSE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  INCOME:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  TRANSFER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  EXCHANGE:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
}

export const eventTypeTabActiveClass: Record<EventType, string> = {
  EXPENSE:
    'data-active:bg-red-100 data-active:text-red-800 dark:data-active:bg-red-900/30 dark:data-active:text-red-300',
  INCOME:
    'data-active:bg-green-100 data-active:text-green-800 dark:data-active:bg-green-900/30 dark:data-active:text-green-300',
  TRANSFER:
    'data-active:bg-blue-100 data-active:text-blue-800 dark:data-active:bg-blue-900/30 dark:data-active:text-blue-300',
  EXCHANGE:
    'data-active:bg-purple-100 data-active:text-purple-800 dark:data-active:bg-purple-900/30 dark:data-active:text-purple-300'
}
