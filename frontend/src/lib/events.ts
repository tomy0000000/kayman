import {
  type EventCreate,
  type EventReadDetailed,
  type TransactionRead,
  createTransaction,
  updateTransactions
} from '@/lib/client'
import { type Client } from '@/lib/client/client'
import { type TransactionPayload } from '@/lib/types'

interface SyncEventTransactionsOptions {
  client: Client
  eventId: number
  // Rows as submitted by the event form, in display order.
  transactions: TransactionPayload[]
  // Rows the event carried before this submit, so dropped rows can be unlinked
  // and an untouched set can skip the patch.
  previousTransactions: TransactionRead[]
  // Applied to newly created transactions, so they land on the event's instant.
  createdAt: string
}

// Whether the submitted body differs from the event being edited, so a submit
// that only touched transactions or entries can skip patching the event.
export function hasEventChanges(body: EventCreate, event: EventReadDetailed) {
  return (
    body.type !== event.type ||
    body.timestamp !== event.timestamp ||
    body.timezone !== event.timezone ||
    (body.description ?? null) !== (event.description ?? null)
  )
}

// Whether a row's tags match the ones it already carries, ignoring order.
function sameTagIds(next: number[], previous: { id: number }[]) {
  if (next.length !== previous.length) return false
  const nextIds = new Set(next)
  return previous.every(({ id }) => nextIds.has(id))
}

// Reconcile an event's transactions with the rows the form submitted: existing
// rows are patched onto the event, dropped rows are unlinked (the API has no
// delete), and new rows are created.
export async function syncEventTransactions({
  client,
  eventId,
  transactions,
  previousTransactions,
  createdAt
}: SyncEventTransactionsOptions) {
  const nextIds = new Set(
    transactions.map(({ id }) => id).filter((id) => id != null)
  )
  const previousById = new Map(previousTransactions.map((row) => [row.id, row]))
  const existing = transactions.filter(({ id }) => id != null)
  const unlinked = previousTransactions.filter(({ id }) => !nextIds.has(id))

  // All or nothing: a reorder can move a row into an index another row still
  // holds, and only the rows in the batch get parked out of the way. So the
  // patch either carries every row or is skipped entirely.
  const changed = existing.some((transaction) => {
    const previous = previousById.get(transaction.id as number)
    return (
      !previous ||
      previous.account_id !== transaction.account_id ||
      previous.amount !== transaction.amount ||
      (previous.index ?? null) !== transaction.index ||
      !sameTagIds(transaction.tag_ids, previous.tags ?? [])
    )
  })
  if (changed || unlinked.length > 0) {
    await updateTransactions({
      client,
      body: [
        ...existing.map(({ id, account_id, amount, tag_ids, index }) => ({
          id: id as number,
          account_id,
          amount,
          tag_ids,
          index,
          event_id: eventId
        })),
        // Unlinked rows keep their tags: omitting `tag_ids` leaves them alone,
        // where `[]` would clear them.
        ...unlinked.map(({ id }) => ({ id, event_id: null }))
      ],
      throwOnError: true
    })
  }

  // Created one at a time: the API has no batch create, and the account balance
  // is server-derived, so concurrent creates on one account would race.
  for (const { account_id, amount, tag_ids, index } of transactions.filter(
    ({ id }) => id == null
  )) {
    await createTransaction({
      client,
      body: {
        account_id,
        amount,
        tag_ids,
        index,
        event_id: eventId,
        created_at: createdAt
      },
      throwOnError: true
    })
  }
}
