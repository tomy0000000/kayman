import { useMemo } from 'react'

import { MilestoneTimeline } from '@/components/milestone-timeline'
import type { TransactionRead } from '@/lib/client'
import { TRANSACTION_STAGES, byLifecycle, toMilestones } from '@/lib/milestones'

interface TransactionTimelineProps {
  transaction: TransactionRead
}

export function TransactionTimeline({ transaction }: TransactionTimelineProps) {
  const items = useMemo(
    () =>
      toMilestones(TRANSACTION_STAGES, transaction, 'transaction', 0).sort(
        byLifecycle
      ),
    [transaction]
  )

  return <MilestoneTimeline items={items} />
}
