import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { type EventReadDetailed } from '@/lib/client'
import { pluralize } from '@/lib/utils'

interface EventDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Kept while closing, so the body does not vanish mid animation.
  event: EventReadDetailed | null
  isPending: boolean
  onConfirm: () => void
}

// What the confirm dialog spells out before an irreversible delete. Only an
// event without transactions can be deleted, so its entries are all that goes
// with it.
const describeDeletion = (event: EventReadDetailed) => {
  const description = event.description?.trim()
  const name = description ? `“${description}”` : 'this event'
  const entries = pluralize(event.entries.length, 'entry', 'entries')
  return `This permanently deletes ${name} and its ${entries}.`
}

export function EventDeleteDialog({
  open,
  onOpenChange,
  event,
  isPending,
  onConfirm
}: EventDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete event?</DialogTitle>
          <DialogDescription>
            {event && describeDeletion(event)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
