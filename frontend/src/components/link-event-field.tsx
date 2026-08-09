import { Link2, X } from 'lucide-react'
import { useState } from 'react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useClientTimezone } from '@/hooks/use-client-timezone'
import type { EventReadDetailed } from '@/lib/client'
import { formatDateTime } from '@/lib/utils'

interface LinkEventFieldProps {
  /** undefined while the events list is loading */
  events: EventReadDetailed[] | undefined
  eventId: number | null
  onChange: (eventId: number | null) => void
}

interface LinkEventTableProps {
  events: EventReadDetailed[] | undefined
  selection: EventReadDetailed | null
  onSelectionChange: (selection: EventReadDetailed | null) => void
}

export function LinkEventField({
  events,
  eventId,
  onChange
}: LinkEventFieldProps) {
  const { timezone } = useClientTimezone()
  const [selection, setSelection] = useState<EventReadDetailed | null>(null)

  const linkedEvent = events?.find((event) => event.id === eventId) ?? null

  const handleLink = () => {
    if (selection) onChange(selection.id)
  }

  return (
    <Dialog
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) setSelection(null)
      }}
    >
      {linkedEvent ? (
        <div className="space-y-3">
          <Item variant="outline" size="sm" className="bg-background">
            <EventTypeBadge type={linkedEvent.type} />
            <ItemContent>
              <ItemTitle>
                {linkedEvent.description || 'No description'}
              </ItemTitle>
              <ItemDescription>
                {formatDateTime(linkedEvent.timestamp, timezone)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Unlink event"
                onClick={() => onChange(null)}
              >
                <X />
              </Button>
            </ItemActions>
          </Item>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Change event
            </Button>
          </DialogTrigger>
        </div>
      ) : eventId != null && events === undefined ? (
        <Item variant="outline" size="sm" className="bg-background">
          <ItemContent>
            <ItemDescription>Loading event…</ItemDescription>
          </ItemContent>
        </Item>
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
          events={events}
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
    <div className="min-h-66 rounded-md border">
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
