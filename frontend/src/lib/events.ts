import { createTransaction, updateTransactions } from '@/lib/client'
import { type Client } from '@/lib/client/client'
import { type TransactionPayload } from '@/lib/types'

interface SyncEventTransactionsOptions {
  client: Client
  eventId: number
  // Rows as submitted by the event form, in display order.
  transactions: TransactionPayload[]
  // Ids the event carried before this submit, so dropped rows can be unlinked.
  previousIds: number[]
  // Applied to newly created transactions, so they land on the event's instant.
  createdAt: string
}

// Reconcile an event's transactions with the rows the form submitted: existing
// rows are patched onto the event, dropped rows are unlinked (the API has no
// delete), and new rows are created.
export async function syncEventTransactions({
  client,
  eventId,
  transactions,
  previousIds,
  createdAt
}: SyncEventTransactionsOptions) {
  const nextIds = new Set(
    transactions.map(({ id }) => id).filter((id) => id != null)
  )
  const updates = [
    ...transactions
      .filter(({ id }) => id != null)
      .map(({ id, account_id, amount, index }) => ({
        id: id as number,
        account_id,
        amount,
        index,
        event_id: eventId
      })),
    ...previousIds
      .filter((id) => !nextIds.has(id))
      .map((id) => ({ id, event_id: null }))
  ]
  if (updates.length > 0) {
    await updateTransactions({ client, body: updates, throwOnError: true })
  }

  // Created one at a time: the API has no batch create, and the account balance
  // is server-derived, so concurrent creates on one account would race.
  for (const { account_id, amount, index } of transactions.filter(
    ({ id }) => id == null
  )) {
    await createTransaction({
      client,
      body: {
        account_id,
        amount,
        index,
        event_id: eventId,
        created_at: createdAt
      },
      throwOnError: true
    })
  }
}
