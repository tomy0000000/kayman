import { Button } from '@/components/ui/button'
import { type OptimisticStatus } from '@/lib/optimistic'
import { cn } from '@/lib/utils'

interface OptimisticItemProps extends React.ComponentProps<'div'> {
  // Undefined for a real row, so a list row can always be wrapped in this.
  status?: OptimisticStatus
  onRetry?: () => void
}

// Row wrapper for the "via the UI" optimistic pattern: dimmed and inert while
// the submission is in flight, error-styled with a retry once it has failed,
// plain for a real row. Use it as the row's root so its layout classes apply.
export function OptimisticItem({
  status,
  onRetry,
  className,
  children,
  ...props
}: OptimisticItemProps) {
  return (
    <div
      className={cn(
        className,
        status === 'pending' && 'pointer-events-none opacity-50',
        status === 'error' && 'text-destructive'
      )}
      {...props}
    >
      {children}
      {status === 'error' && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
