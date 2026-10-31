import { useMemo } from 'react'

import { MilestoneTimeline } from '@/components/milestone-timeline'
import type { EventReadDetailed } from '@/lib/client'
import {
  EVENT_STAGES,
  TRANSACTION_STAGES,
  byLifecycle,
  toMilestones
} from '@/lib/milestones'

interface EventTimelineProps {
  event: EventReadDetailed
  accountNames: Map<number, string>
}

export function EventTimeline({ event, accountNames }: EventTimelineProps) {
  const items = useMemo(
    () =>
      [
        ...toMilestones(EVENT_STAGES, event, 'event', 0),
        ...event.transactions.flatMap((transaction) =>
          toMilestones(
            TRANSACTION_STAGES,
            transaction,
            `transaction-${transaction.id}`,
            transaction.index ?? 0,
            accountNames.get(transaction.account_id) ??
              `#${transaction.account_id}`
          )
        )
      ].sort(byLifecycle),
    [event, accountNames]
  )

  return <MilestoneTimeline items={items} />
}
