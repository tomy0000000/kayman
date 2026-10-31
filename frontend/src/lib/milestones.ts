import type { EventReadDetailed, TransactionRead } from '@/lib/client'

export interface Milestone {
  key: string
  title: string
  detail?: string // Account name, absent on the event's own milestones.
  timestamp: string | null // null when it has not happened.
  // Rendered where the date goes, for a milestone with no instant of its own
  // to show.
  note?: string
  // Lifecycle position, breaking ties between milestones sharing an instant.
  rank: number
  transactionIndex: number
}

interface Stage<T> {
  key: string
  title: string
  rank: number
  at: (subject: T) => string | null
  note?: (subject: T) => string
  // A milestone that has not happened is listed muted at the end. Omitted
  // instead when the stage is not one every subject is bound to reach.
  omitWhenAbsent?: true
}

export const EVENT_STAGES: Stage<EventReadDetailed>[] = [
  { key: 'occurred', title: 'Event occurred', rank: 0, at: (e) => e.timestamp },
  {
    key: 'cleared',
    title: 'Event cleared',
    rank: 5,
    at: (e) => e.cleared_at ?? null
  }
]

export const TRANSACTION_STAGES: Stage<TransactionRead>[] = [
  { key: 'created', title: 'Created', rank: 1, at: (t) => t.created_at },
  { key: 'posted', title: 'Posted', rank: 2, at: (t) => t.posted_at ?? null },
  {
    key: 'billed',
    title: 'Billed',
    rank: 3,
    // No instant of its own: the date lives on the statement, and there is no
    // GET /api/statements to read it from. Borrows the posting it follows so
    // it still lands in the right place.
    at: (t) => (t.statement_id == null ? null : (t.posted_at ?? t.created_at)),
    note: (t) => `Statement #${t.statement_id}`,
    // Not every account ever gets a statement, so a permanent ghost here would
    // read as a step that is owed.
    omitWhenAbsent: true
  },
  { key: 'cleared', title: 'Cleared', rank: 4, at: (t) => t.cleared_at ?? null }
]

// Milestones that happened come first, oldest to newest, and the ones still
// outstanding follow in lifecycle order. Within a single instant the stage
// decides, then the transaction, so a Transfer's two legs stay grouped stage
// by stage rather than interleaving.
export function byLifecycle(a: Milestone, b: Milestone): number {
  const order = a.rank - b.rank || a.transactionIndex - b.transactionIndex
  if (a.timestamp === null || b.timestamp === null) {
    if (a.timestamp !== null) return -1
    if (b.timestamp !== null) return 1
    return order
  }
  return Date.parse(a.timestamp) - Date.parse(b.timestamp) || order
}

export function toMilestones<T>(
  stages: Stage<T>[],
  subject: T,
  keyPrefix: string,
  transactionIndex: number,
  detail?: string
): Milestone[] {
  return stages
    .filter((stage) => !stage.omitWhenAbsent || stage.at(subject) !== null)
    .map((stage) => {
      const timestamp = stage.at(subject)
      return {
        key: `${keyPrefix}-${stage.key}`,
        title: stage.title,
        detail,
        timestamp,
        note: timestamp === null ? undefined : stage.note?.(subject),
        rank: stage.rank,
        transactionIndex
      }
    })
}
