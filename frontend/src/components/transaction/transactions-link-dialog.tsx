import { type ReactNode, useState } from 'react'

import {
  LinkTransactionsTable,
  type SelectedTransaction
} from '@/components/link-transactions-table'
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
import { type AccountRead } from '@/lib/client'

interface TransactionsLinkDialogProps {
  accounts: AccountRead[]
  onLink: (selection: SelectedTransaction[]) => void
  // The element that opens the dialog, rendered as the trigger.
  children: ReactNode
}

export function TransactionsLinkDialog({
  accounts,
  onLink,
  children
}: TransactionsLinkDialogProps) {
  const [selection, setSelection] = useState<SelectedTransaction[]>([])

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setSelection([])
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="min-w-sm sm:min-w-sm sm:max-w-[min(calc(100%-2rem),48rem)]">
        <DialogHeader>
          <DialogTitle>Link transactions</DialogTitle>
          <DialogDescription>
            Select existing transactions to attach to this event.
          </DialogDescription>
        </DialogHeader>
        <LinkTransactionsTable
          accounts={accounts}
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
              disabled={selection.length === 0}
              onClick={() => onLink(selection)}
            >
              Link
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
