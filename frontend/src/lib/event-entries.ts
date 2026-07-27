import {
  type EventEntryRead,
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
  // Entries the event carried before this submit, so dropped rows can be
  // deleted and untouched rows can be left out of the patch.
  previousEntries: EventEntryRead[]
}

function isUnchanged(entry: EventEntryPayload, previous: EventEntryRead) {
  return (
    entry.category_id === previous.category_id &&
    entry.amount === previous.amount &&
    entry.quantity === previous.quantity &&
    entry.currency_code === previous.currency_code &&
    entry.description === (previous.description ?? null) &&
    entry.index === previous.index
  )
}

// Reconcile an event's entries with the rows the form submitted: dropped rows
// are deleted, changed rows are patched, and new rows are created.
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
  previousEntries
}: SyncEventEntriesOptions) {
  const nextIds = new Set(
    entries.map(({ id }) => id).filter((id) => id != null)
  )
  const removedIds = previousEntries
    .map(({ id }) => id)
    .filter((id) => !nextIds.has(id))
  if (removedIds.length > 0) {
    await deleteEventEntries({
      client,
      query: { ids: removedIds },
      throwOnError: true
    })
  }

  const previousById = new Map(
    previousEntries.map((entry) => [entry.id, entry])
  )
  const surviving = entries.filter(({ id }) => id != null)
  // A reorder moves rows into indexes other rows still hold, and only the rows
  // in the batch get parked, so a reorder has to send all of them. Absent one,
  // no row is moving and untouched rows can be left out.
  const reordered = surviving.some(
    (entry) => previousById.get(entry.id as number)?.index !== entry.index
  )
  const updates = surviving
    .filter((entry) => {
      if (reordered) return true
      const previous = previousById.get(entry.id as number)
      return !previous || !isUnchanged(entry, previous)
    })
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
