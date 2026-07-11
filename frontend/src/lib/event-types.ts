import { type EventType } from '@/lib/client'

// Semantic color per event type, shared by the create-event tabs and the
// event-type badge so the palette lives in one place. Tailwind only detects
// class names written out literally, so the plain badge form and the
// `data-active:` tab form are listed side by side rather than derived.

export const eventTypeBadgeClass: Record<EventType, string> = {
  Expense: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Income:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Transfer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Exchange:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
}

export const eventTypeTabActiveClass: Record<EventType, string> = {
  Expense:
    'data-active:bg-red-100 data-active:text-red-800 dark:data-active:bg-red-900/30 dark:data-active:text-red-300',
  Income:
    'data-active:bg-green-100 data-active:text-green-800 dark:data-active:bg-green-900/30 dark:data-active:text-green-300',
  Transfer:
    'data-active:bg-blue-100 data-active:text-blue-800 dark:data-active:bg-blue-900/30 dark:data-active:text-blue-300',
  Exchange:
    'data-active:bg-purple-100 data-active:text-purple-800 dark:data-active:bg-purple-900/30 dark:data-active:text-purple-300'
}
