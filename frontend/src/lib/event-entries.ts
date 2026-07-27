import {
  createEventEntries,
  deleteEventEntries,
  updateEventEntries
} from '@/lib/client'
import { type Client } from '@/lib/client/client'
import { type EventEntryPayload } from '@/lib/types'

interface SyncEventEntriesOptions {
  client: Client
  eventId: number
  // Rows as submitted by the event form, in display order.
  entries: EventEntryPayload[]
  // Ids the event carried before this submit, so dropped rows can be deleted.
  previousIds: number[]
}

// Reconcile an event's entries with the rows the form submitted: dropped rows
// are deleted, existing rows are patched, and new rows are created.
//
// The three calls must stay in this order. Indexes are unique per event, and
// the API only parks colliding indexes out of the way for rows inside the batch
// it is given. So dropped rows have to go before a survivor can move into the
// index they held, and new rows have to come last so the indexes the patch
// vacated are free by the time they claim them.
export async function syncEventEntries({
  client,
  eventId,
  entries,
  previousIds
}: SyncEventEntriesOptions) {
  const nextIds = new Set(
    entries.map(({ id }) => id).filter((id) => id != null)
  )
  const removedIds = previousIds.filter((id) => !nextIds.has(id))
  if (removedIds.length > 0) {
    await deleteEventEntries({
      client,
      query: { ids: removedIds },
      throwOnError: true
    })
  }

  // Every surviving row is sent, not just the edited ones, so the whole index
  // range the patch writes to is inside the batch and can be parked.
  const updates = entries
    .filter(({ id }) => id != null)
    .map((entry) => ({ ...entry, id: entry.id as number, event_id: eventId }))
  if (updates.length > 0) {
    await updateEventEntries({ client, body: updates, throwOnError: true })
  }

  const creates = entries
    .filter(({ id }) => id == null)
    .map((entry) => ({ ...entry, event_id: eventId }))
  if (creates.length > 0) {
    await createEventEntries({ client, body: creates, throwOnError: true })
  }
}
