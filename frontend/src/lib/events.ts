import {
  type AccountRead,
  type EventCreate,
  type EventReadDetailed,
  type TransactionEventLinkDetailedRead,
  type TransactionEventLinkRead,
  type TransactionEventRead,
  type TransactionRead,
  type TransactionReadWithBalance,
  createTransaction,
  createTransactionEventLinks,
  deleteTransactionEventLinks,
  updateTransactionEventLinks,
  updateTransactions
} from '@/lib/client'
import { type Client } from '@/lib/client/client'
import { PLACEHOLDER_ID } from '@/lib/optimistic'
import {
  type EventEntryPayload,
  type EventLinkPayload,
  type TransactionPayload
} from '@/lib/types'
import { formatCurrency, sameDecimal } from '@/lib/utils'

export interface TransactionEventSummary {
  title: string | null
  subtitle: string | null
  note: string | null
  moreEvents: number
}

function joinUnique(values: (string | null | undefined)[]): string | null {
  const unique = new Set(
    values.map((value) => value?.trim()).filter((value) => !!value)
  )
  return [...unique].join(', ') || null
}

// What an event is called: its description, else its entries, else its categories.
export function eventTitle(
  event: TransactionEventRead,
  categoryNames: Map<number, string>
): string | null {
  return (
    event.description?.trim() ||
    joinUnique(event.entries.map((entry) => entry.description)) ||
    eventCategories(event, categoryNames)
  )
}

function eventCategories(
  event: TransactionEventRead,
  categoryNames: Map<number, string>
): string | null {
  return joinUnique(
    event.entries.map(
      (entry) => categoryNames.get(entry.category_id) ?? `#${entry.category_id}`
    )
  )
}

// What a transaction's row says about its first event, as seen from this account.
export function summarizeTransactionEvent(
  transaction: TransactionReadWithBalance,
  categoryNames: Map<number, string>,
  accountNames: Map<number, string>
): TransactionEventSummary {
  const note = transaction.description?.trim() || null
  const links = transaction.event_links
  const event = links[0]?.event
  if (!event) return { title: note, subtitle: null, note: null, moreEvents: 0 }

  const categories = eventCategories(event, categoryNames)
  const title = eventTitle(event, categoryNames)

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
  return { title, subtitle, note, moreEvents: links.length - 1 }
}

interface SyncEventTransactionsOptions {
  client: Client
  eventId: number
  // Rows as submitted by the event form, in display order.
  transactions: TransactionPayload[]
  // The event before this submit (null for a new event), for its legs' links.
  previousEvent: EventReadDetailed | null
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

// A leg's amount on this event: its link's share, else the whole transaction.
export function legAmount(
  event: EventReadDetailed,
  transaction: TransactionRead
): string {
  const link = event.transaction_links.find(
    (link) => link.transaction_id === transaction.id
  )
  return link?.amount ?? transaction.amount
}

// Whether the transaction's whole amount sits on this one link.
function isUnsplit(
  transaction: TransactionRead,
  link?: TransactionEventLinkRead
) {
  return (
    transaction.event_links.length <= 1 &&
    (!link || sameDecimal(link.amount, transaction.amount))
  )
}

// Reconcile an event's legs with the rows the form submitted, through links.
export async function syncEventTransactions({
  client,
  eventId,
  transactions,
  previousEvent,
  createdAt
}: SyncEventTransactionsOptions) {
  const previousById = new Map(
    (previousEvent?.transactions ?? []).map((row) => [row.id, row])
  )
  const linkByTransaction = new Map(
    (previousEvent?.transaction_links ?? []).map((link) => [
      link.transaction_id,
      link
    ])
  )
  const nextIds = new Set(transactions.map(({ id }) => id))

  // Dropping a leg deletes its link, which also unlinks the row if it was the FK.
  const removed = [...linkByTransaction.values()].filter(
    (link) => !nextIds.has(link.transaction_id)
  )
  if (removed.length > 0) {
    await deleteTransactionEventLinks({
      client,
      query: { ids: removed.map(({ id }) => id) },
      throwOnError: true
    })
  }

  const linked = transactions.filter(
    ({ id }) => id != null && linkByTransaction.has(id)
  )
  // All or nothing: a reorder can only park the links in the batch
  const linksChanged = linked.some((row) => {
    const link = linkByTransaction.get(row.id as number)!
    return link.index !== row.index || !sameDecimal(link.amount, row.amount)
  })
  if (linksChanged) {
    await updateTransactionEventLinks({
      client,
      body: linked.map((row) => ({
        id: linkByTransaction.get(row.id as number)!.id,
        index: row.index,
        amount: row.amount
      })),
      throwOnError: true
    })
  }

  // Existing rows new to this event carry no links yet, so they are unsplit
  const attached = transactions.filter(
    ({ id }) => id != null && !linkByTransaction.has(id)
  )
  const transactionUpdates = [
    ...linked.flatMap((row) => {
      const previous = previousById.get(row.id as number)!
      const link = linkByTransaction.get(row.id as number)
      const amount = isUnsplit(previous, link) ? row.amount : previous.amount
      const unchanged =
        previous.account_id === row.account_id &&
        sameDecimal(previous.amount, amount) &&
        sameTagIds(row.tag_ids, previous.tags ?? [])
      if (unchanged) return []
      return [
        {
          id: previous.id,
          account_id: row.account_id,
          amount,
          tag_ids: row.tag_ids
        }
      ]
    }),
    ...attached.map(({ id, account_id, amount, tag_ids }) => ({
      id: id as number,
      account_id,
      amount,
      tag_ids
    }))
  ]
  if (transactionUpdates.length > 0) {
    await updateTransactions({
      client,
      body: transactionUpdates,
      throwOnError: true
    })
  }

  const newLinks = attached.map(({ id, amount, index }) => ({
    transaction_id: id as number,
    event_id: eventId,
    amount,
    index
  }))
  // Created one at a time: the API has no batch create, and the account balance
  // is server-derived, so concurrent creates on one account would race.
  for (const { account_id, amount, tag_ids, index } of transactions.filter(
    ({ id }) => id == null
  )) {
    const { data } = await createTransaction({
      client,
      body: { account_id, amount, tag_ids, created_at: createdAt },
      throwOnError: true
    })
    newLinks.push({ transaction_id: data.id, event_id: eventId, amount, index })
  }
  if (newLinks.length > 0) {
    await createTransactionEventLinks({
      client,
      body: newLinks,
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
  const cleared_at = base?.cleared_at ?? null
  const legs = transactions.map((payload, index) => {
    const existing = base?.transactions.find(({ id }) => id === payload.id)
    const transactionId = payload.id ?? PLACEHOLDER_ID - index
    const previousLink = base?.transaction_links.find(
      (link) => link.transaction_id === transactionId
    )
    const link = {
      id: previousLink?.id ?? PLACEHOLDER_ID - index,
      transaction_id: transactionId,
      event_id: id,
      amount: payload.amount,
      index: payload.index
    }
    const transaction: TransactionRead = {
      ...(existing ?? {
        id: transactionId,
        created_at: body.timestamp,
        currency_code:
          accounts.find(({ id }) => id === payload.account_id)?.currency_code ??
          '',
        event: null,
        event_id: null,
        event_links: [],
        status: 'PENDING' as const
      }),
      account_id: payload.account_id,
      // A split leg's row keeps its whole amount, only its share changed
      amount:
        existing && !isUnsplit(existing, previousLink)
          ? existing.amount
          : payload.amount,
      event_links: [
        ...(existing?.event_links ?? []).filter(
          (other) => other.event_id !== id
        ),
        { ...link, event: { ...body, id, cleared_at } }
      ]
    }
    return { link, transaction }
  })
  return {
    ...base,
    ...body,
    id,
    cleared_at,
    transaction_links: legs.map(({ link }) => link),
    transactions: legs.map(({ transaction }) => transaction),
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

// A transaction's links once a form submit succeeds; events missing from the list drop out.
export function predictTransactionLinks(
  links: EventLinkPayload[],
  transactionId: number,
  previous: TransactionEventLinkDetailedRead[],
  events: EventReadDetailed[] | undefined
): TransactionEventLinkDetailedRead[] {
  return links.flatMap((link, index) => {
    const before = previous.find(({ id }) => id === link.id)
    const event =
      before?.event ?? events?.find(({ id }) => id === link.event_id)
    if (!event) return []
    return [
      {
        id: link.id ?? PLACEHOLDER_ID - index,
        transaction_id: transactionId,
        event_id: link.event_id,
        amount: link.amount,
        index: link.index ?? before?.index ?? 0,
        event
      }
    ]
  })
}
