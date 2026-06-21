import { Badge } from '@/components/ui/badge'
import { type TransactionStatus } from '@/lib/client'
import { cn } from '@/lib/utils'

interface TransactionBadgeProps extends React.ComponentProps<typeof Badge> {
  status: TransactionStatus
}

const statusClass: Record<TransactionStatus, string> = {
  PENDING:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  POSTED:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CLEARED:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
}

function TransactionBadge({
  status,
  className,
  ...props
}: TransactionBadgeProps) {
  return (
    <Badge className={cn(statusClass[status], className)} {...props}>
      {status.toLowerCase()}
    </Badge>
  )
}

export { TransactionBadge }
