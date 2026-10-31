import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle
} from '@/components/ui/timeline'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import { type Milestone } from '@/lib/milestones'
import { formatDateTime } from '@/lib/utils'

interface MilestoneTimelineProps {
  // Already in display order, see `byLifecycle`.
  items: Milestone[]
}

export function MilestoneTimeline({ items }: MilestoneTimelineProps) {
  const { timezone } = useClientTimezone()

  const reached = items.filter(
    (milestone) => milestone.timestamp !== null
  ).length

  return (
    <div className="flex flex-col gap-3">
      <span className="font-semibold">History</span>
      <Timeline value={reached}>
        {items.map((milestone, index) => (
          <TimelineItem key={milestone.key} step={index + 1}>
            <TimelineHeader>
              <TimelineSeparator />
              <TimelineIndicator />
              {milestone.timestamp !== null && milestone.note === undefined ? (
                <TimelineDate>
                  {formatDateTime(milestone.timestamp, timezone)}
                </TimelineDate>
              ) : (
                <TimelineDate render={<span />}>
                  {milestone.note ?? 'Not yet'}
                </TimelineDate>
              )}
              <TimelineTitle>{milestone.title}</TimelineTitle>
            </TimelineHeader>
            {milestone.detail && (
              <TimelineContent className="text-xs">
                {milestone.detail}
              </TimelineContent>
            )}
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  )
}
