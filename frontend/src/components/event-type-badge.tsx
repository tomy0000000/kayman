import { Badge } from '@/components/ui/badge'
import { type EventType } from '@/lib/client'
import { eventTypeBadgeClass } from '@/lib/event-types'
import { cn } from '@/lib/utils'

interface EventTypeBadgeProps extends React.ComponentProps<typeof Badge> {
  type: EventType
}

function EventTypeBadge({ type, className, ...props }: EventTypeBadgeProps) {
  return (
    <Badge className={cn(eventTypeBadgeClass[type], className)} {...props}>
      {type}
    </Badge>
  )
}

export { EventTypeBadge }
