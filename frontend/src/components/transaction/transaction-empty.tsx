import { ArrowLeftRight } from 'lucide-react'
import { type ReactNode } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'

interface TransactionEmptyProps {
  // The call to action, which differs per caller (add a draft, open the link
  // dialog).
  children: ReactNode
}

export function TransactionEmpty({ children }: TransactionEmptyProps) {
  return (
    <Empty className="border border-dashed py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArrowLeftRight />
        </EmptyMedia>
        <EmptyTitle>No transactions</EmptyTitle>
        <EmptyDescription>
          Record the money movement behind this event.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{children}</EmptyContent>
    </Empty>
  )
}
