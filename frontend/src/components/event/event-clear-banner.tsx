import { CircleAlert, CircleCheck } from 'lucide-react'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { type EventClearError } from '@/lib/client'

interface EventClearBannerProps {
  errors: EventClearError[]
  isLoading: boolean
  onClear: () => void
  isClearPending: boolean
}

const ERROR_CLASSES =
  'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
const SUCCESS_CLASSES =
  'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
const SUCCESS_BUTTON_CLASSES =
  'border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900 focus-visible:border-green-400 focus-visible:ring-green-500/20 dark:border-green-700 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800 dark:hover:text-green-50 dark:focus-visible:ring-green-400/40'

export function EventClearBanner({
  errors,
  isLoading,
  onClear,
  isClearPending
}: EventClearBannerProps) {
  if (isLoading) return <Skeleton className="h-14 w-full rounded-lg" />

  if (errors.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {errors.map((error, index) => (
          <Alert key={`${error.type}-${index}`} className={ERROR_CLASSES}>
            <CircleAlert />
            <AlertTitle>{error.msg}</AlertTitle>
          </Alert>
        ))}
      </div>
    )
  }

  return (
    <Alert className={SUCCESS_CLASSES}>
      <CircleCheck />
      <AlertTitle>Ready to clear</AlertTitle>
      <AlertDescription className="text-green-800/90 dark:text-green-200/90">
        Nothing is blocking this event.
      </AlertDescription>
      <AlertAction>
        <Button
          variant="ghost"
          size="sm"
          className={SUCCESS_BUTTON_CLASSES}
          onClick={onClear}
          disabled={isClearPending}
        >
          Clear
        </Button>
      </AlertAction>
    </Alert>
  )
}
