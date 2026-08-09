import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'

interface FieldEmptyProps {
  icon: LucideIcon
  title: string
  description: string
  // The call to action, which differs per caller (add a draft row, open a
  // link dialog).
  children: ReactNode
}

export function FieldEmpty({
  icon: Icon,
  title,
  description,
  children
}: FieldEmptyProps) {
  return (
    <Empty className="border border-dashed py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{children}</EmptyContent>
    </Empty>
  )
}
