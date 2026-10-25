import {
  type AccountRead,
  type EventCreate,
  type EventReadDetailed,
  type TransactionRead,
  type TransactionReadWithBalance,
  createTransaction,
  updateTransactions
} from '@/lib/client'
import { type Client } from '@/lib/client/client'
import { PLACEHOLDER_ID } from '@/lib/optimistic'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export interface TransactionEventSummary {
  title: string | null
  subtitle: string | null
  note: string | null
}

function joinUnique(values: (string | null | undefined)[]): string | null {
  const unique = new Set(
    values.map((value) => value?.trim()).filter((value) => !!value)
  )
  return [...unique].join(', ') || null
}

// What a transaction's row says about its event, as seen from this account.
export function summarizeTransactionEvent(
  transaction: TransactionReadWithBalance,
  categoryNames: Map<number, string>,
  accountNames: Map<number, string>
): TransactionEventSummary {
  const note = transaction.description?.trim() || null
  const { event } = transaction
  if (!event) return { title: note, subtitle: null, note: null }

  const categories = joinUnique(
    event.entries.map(
      (entry) => categoryNames.get(entry.category_id) ?? `#${entry.category_id}`
    )
  )
  const title =
    event.description?.trim() ||
    joinUnique(event.entries.map((entry) => entry.description)) ||
    categories

  const arrow = Number(transaction.amount) < 0 ? '→' : '←'
  const others = event.transactions.filter(
    (leg) => leg.account_id !== transaction.account_id
  )
  const accountName = (id: number) => accountNames.get(id) ?? `#${id}`
  let subtitle: string | null = null
  if (event.type === 'TRANSFER') {
    subtitle = joinUnique(
      others.map((leg) => `${arrow} ${accountName(leg.account_id)}`)
    )
  } else if (event.type === 'EXCHANGE') {
    subtitle = joinUnique(
      others.map(
        (leg) =>
          `${arrow} ${formatCurrency(Math.abs(Number(leg.amount)), leg.currency_code)} · ${accountName(leg.account_id)}`
      )
    )
  } else if (title !== categories) {
    subtitle = categories
  }
  return { title, subtitle, note }
}

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

// The cached event once the submit succeeds; rows of `base` keep their server
// fields where the payload still carries their id.
export function predictEvent(
  body: EventCreate,
  transactions: TransactionPayload[],
  entries: EventEntryPayload[],
  accounts: AccountRead[],
  base?: EventReadDetailed
): EventReadDetailed {
  const id = base?.id ?? PLACEHOLDER_ID
  return {
    ...base,
    ...body,
    id,
    cleared_at: base?.cleared_at ?? null,
    transactions: transactions.map((payload, index) => {
      const existing = base?.transactions.find(({ id }) => id === payload.id)
      return {
        ...(existing ?? {
          id: PLACEHOLDER_ID - index,
          created_at: body.timestamp,
          currency_code:
            accounts.find(({ id }) => id === payload.account_id)
              ?.currency_code ?? '',
          event: null,
          status: 'PENDING' as const
        }),
        event_id: id,
        account_id: payload.account_id,
        amount: payload.amount,
        index: payload.index
      }
    }),
    entries: entries.map((payload, index) => ({
      ...(base?.entries.find(({ id }) => id === payload.id) ?? {
        id: PLACEHOLDER_ID - index
      }),
      event_id: id,
      category_id: payload.category_id,
      amount: payload.amount,
      quantity: payload.quantity,
      currency_code: payload.currency_code,
      description: payload.description,
      index: payload.index
    }))
  }
}
