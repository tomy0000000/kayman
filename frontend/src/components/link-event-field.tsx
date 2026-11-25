import { Link2, X } from 'lucide-react'
import { useState } from 'react'

import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { EventTypeBadge } from '@/components/event/event-type-badge'
import { FieldEmpty } from '@/components/field-empty'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import type { CurrencyRead, EventReadDetailed } from '@/lib/client'
import { type EventLinkDraft } from '@/lib/types'
import {
  addDecimals,
  formatCurrency,
  formatDateTime,
  isAmount,
  negateDecimal,
  sameDecimal
} from '@/lib/utils'

interface LinkEventFieldProps {
  /** undefined while the events list is loading */
  events: EventReadDetailed[] | undefined
  links: EventLinkDraft[]
  // The transaction's amount, which a single link takes whole
  amount: string
  currency: CurrencyRead | undefined
  onChange: (links: EventLinkDraft[]) => void
}

interface LinkEventTableProps {
  events: EventReadDetailed[] | undefined
  selection: EventReadDetailed | null
  onSelectionChange: (selection: EventReadDetailed | null) => void
}

export function LinkEventField({
  events,
  links,
  amount,
  currency,
  onChange
}: LinkEventFieldProps) {
  const { timezone } = useClientTimezone()
  const [selection, setSelection] = useState<EventReadDetailed | null>(null)

  const linkedIds = new Set(links.map(({ event }) => event.id))
  const isSplit = links.length > 1
  const unallocated = isSplit
    ? links.reduce(
        (rest, link) =>
          isAmount(link.amount)
            ? addDecimals(rest, negateDecimal(link.amount))
            : rest,
        isAmount(amount) ? amount : '0'
      )
    : '0'

  const handleLink = () => {
    if (!selection) return
    // The new share starts as whatever the others leave unclaimed
    const share = links.length === 0 ? amount : unallocated
    onChange([
      ...links.map((link) => (links.length === 1 ? { ...link, amount } : link)),
      { id: null, event: selection, amount: share }
    ])
  }

  return (
    <Dialog
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) setSelection(null)
      }}
    >
      {links.length > 0 ? (
        <div className="space-y-3">
          {links.map((link, index) => (
            <Item
              key={link.id ?? `new-${link.event.id}`}
              variant="outline"
              size="sm"
              className="bg-background"
            >
              <EventTypeBadge type={link.event.type} />
              <ItemContent>
                <ItemTitle>
                  {link.event.description || 'No description'}
                </ItemTitle>
                <ItemDescription>
                  {formatDateTime(link.event.timestamp, timezone)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {isSplit && (
                  <CurrencyAmountInput
                    amount={link.amount}
                    onAmountChange={(share) =>
                      onChange(
                        links.map((other, at) =>
                          at === index ? { ...other, amount: share } : other
                        )
                      )
                    }
                    currency={currency}
                    required
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Unlink event"
                  onClick={() =>
                    onChange(links.filter((_, at) => at !== index))
                  }
                >
                  <X />
                </Button>
              </ItemActions>
            </Item>
          ))}
          {isSplit && !sameDecimal(unallocated, '0') && (
            <p className="text-muted-foreground text-sm">
              Unallocated:{' '}
              {currency
                ? formatCurrency(Number(unallocated), currency.code)
                : unallocated}
            </p>
          )}
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Link another event
            </Button>
          </DialogTrigger>
        </div>
      ) : (
        <FieldEmpty
          icon={Link2}
          title="No event linked"
          description="Link an event to this transaction."
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Link event
            </Button>
          </DialogTrigger>
        </FieldEmpty>
      )}

      <DialogContent className="min-w-sm sm:min-w-sm sm:max-w-[min(calc(100%-2rem),48rem)]">
        <DialogHeader>
          <DialogTitle>Link event</DialogTitle>
          <DialogDescription>
            Select an event to link to this transaction.
          </DialogDescription>
        </DialogHeader>
        <LinkEventTable
          events={events?.filter(({ id }) => !linkedIds.has(id))}
          selection={selection}
          onSelectionChange={setSelection}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              type="button"
              disabled={selection === null}
              onClick={handleLink}
            >
              Link
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkEventTable({
  events,
  selection,
  onSelectionChange
}: LinkEventTableProps) {
  const { timezone } = useClientTimezone()

  const toggleEvent = (event: EventReadDetailed) =>
    onSelectionChange(selection?.id === event.id ? null : event)

  return (
    <div className="h-66 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events?.length ? (
            events.map((event) => (
              <TableRow
                key={event.id}
                data-state={selection?.id === event.id ? 'selected' : undefined}
                onClick={() => toggleEvent(event)}
                className="cursor-pointer"
              >
                <TableCell>
                  <EventTypeBadge type={event.type} />
                </TableCell>
                <TableCell>{event.description}</TableCell>
                <TableCell>
                  {formatDateTime(event.timestamp, timezone)}
                </TableCell>
              </TableRow>
            ))
          ) : events === undefined ? (
            Array.from({ length: 3 }, (_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-5 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40 max-w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-66 text-center text-muted-foreground"
              >
                No events.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
