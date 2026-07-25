import { Link2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogTrigger } from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'

export function TransactionEmpty() {
  return (
    <Empty className="border border-dashed py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Link2 />
        </EmptyMedia>
        <EmptyTitle>No transactions linked</EmptyTitle>
        <EmptyDescription>
          Link one or more transactions to this event.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Link transactions
          </Button>
        </DialogTrigger>
      </EmptyContent>
    </Empty>
  )
}
