import { GripVertical, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'

import { Amount } from '@/components/amount'
import {
  LinkTransactionsTable,
  type SelectedTransaction
} from '@/components/link-transactions-table'
import { TransactionEmpty } from '@/components/transaction/transaction-empty'
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
import { type AccountRead } from '@/lib/client'
import { formatDateTime } from '@/lib/utils'

interface LinkedTransactionsFieldProps {
  accounts: AccountRead[]
  value: SelectedTransaction[]
  onChange: (value: SelectedTransaction[]) => void
}

interface LinkedTransactionItemProps {
  item: SelectedTransaction
  onUnlink: (id: number) => void
}

export function LinkedTransactionsField({
  accounts,
  value,
  onChange
}: LinkedTransactionsFieldProps) {
  const [selection, setSelection] = useState<SelectedTransaction[]>([])

  const handleLink = () => {
    if (selection.length === 0) return
    const existing = new Set(value.map((item) => item.transaction.id))
    const additions = selection.filter(
      (item) => !existing.has(item.transaction.id)
    )
    if (additions.length > 0) onChange([...value, ...additions])
  }

  const unlinkTransaction = (id: number) =>
    onChange(value.filter((item) => item.transaction.id !== id))

  return (
    <Dialog
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) setSelection([])
      }}
    >
      {value.length === 0 ? (
        <TransactionEmpty />
      ) : (
        <div className="space-y-3">
          <Reorder.Group
            axis="y"
            values={value}
            onReorder={onChange}
            className="flex w-full flex-col gap-2.5"
          >
            {value.map((item) => (
              <LinkedTransactionItem
                key={item.transaction.id}
                item={item}
                onUnlink={unlinkTransaction}
              />
            ))}
          </Reorder.Group>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Link more transactions
            </Button>
          </DialogTrigger>
        </div>
      )}

      <DialogContent className="min-w-sm sm:min-w-sm sm:max-w-[min(calc(100%-2rem),48rem)]">
        <DialogHeader>
          <DialogTitle>Link transactions</DialogTitle>
          <DialogDescription>
            Select transactions to link to this event.
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

function LinkedTransactionItem({ item, onUnlink }: LinkedTransactionItemProps) {
  const { transaction, account } = item
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
    >
      <Item variant="outline" size="sm" className="bg-background">
        <span
          aria-label="Drag to reorder"
          className="flex cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="size-4" />
        </span>
        <ItemContent>
          <ItemTitle>{account.name}</ItemTitle>
          <ItemDescription>
            {formatDateTime(transaction.created_at)}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Amount
            amount={parseFloat(transaction.amount)}
            currencyCode={account.currency_code}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Unlink transaction"
            onClick={() => onUnlink(transaction.id)}
          >
            <X />
          </Button>
        </ItemActions>
      </Item>
    </Reorder.Item>
  )
}
