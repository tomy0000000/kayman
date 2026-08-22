import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import type { TreeItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TreeProps {
  treeData: TreeItem[] | undefined
  isPending: boolean
}

interface TreeNodeProps {
  item: TreeItem
  currentId: string | null
  setCurrentId: (id: string | null) => void
  level: number
}

const SKELETON_ROWS: { level: number; width: string }[] = [
  { level: 0, width: 'w-32' },
  { level: 1, width: 'w-24' },
  { level: 1, width: 'w-28' },
  { level: 0, width: 'w-36' },
  { level: 1, width: 'w-24' }
]

export function Tree({ treeData, isPending }: TreeProps) {
  const [currentId, setCurrentId] = useState<string | null>(null)

  if (isPending) {
    return (
      <ul role="tree" className="text-sm">
        {SKELETON_ROWS.map(({ level, width }, index) => (
          <li key={index}>
            <div
              className="flex items-center gap-1 py-1.5"
              style={{ paddingLeft: level * 12 }}
            >
              <span className="w-5" />
              <Skeleton className={cn('h-4', width)} />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul role="tree" className="text-sm">
      {treeData?.map((item) => (
        <TreeNode
          key={item.id}
          item={item}
          currentId={currentId}
          setCurrentId={setCurrentId}
          level={0}
        />
      ))}
    </ul>
  )
}

function TreeNode({ item, currentId, setCurrentId, level }: TreeNodeProps) {
  const hasChildren = !!item.children?.length
  const isCurrent = currentId === item.id
  const isAncestorOfCurrent = currentId?.startsWith(item.id + '-') ?? false
  const [open, setOpen] = useState(isAncestorOfCurrent)
  const [prevIsAncestor, setPrevIsAncestor] = useState(isAncestorOfCurrent)

  if (prevIsAncestor !== isAncestorOfCurrent) {
    setPrevIsAncestor(isAncestorOfCurrent)
    if (isAncestorOfCurrent) setOpen(true)
  }

  const row = (
    <div
      className={cn(
        'group hover:bg-accent flex items-center gap-1 rounded-sm',
        isCurrent && 'bg-accent font-medium'
      )}
      style={{ paddingLeft: level * 12 }}
    >
      {hasChildren ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            className="hover:bg-muted rounded p-1"
          >
            <ChevronRight
              className={cn('size-3 transition-transform', open && 'rotate-90')}
            />
          </button>
        </CollapsibleTrigger>
      ) : (
        <span className="w-5" />
      )}
      <button
        type="button"
        onClick={() => {
          setCurrentId(item.id)
          if (hasChildren) setOpen((prev) => !prev)
        }}
        className="flex-1 py-1 pr-2 text-left"
      >
        {item.label}
      </button>
    </div>
  )

  if (!hasChildren) {
    return <li role="treeitem">{row}</li>
  }

  return (
    <li role="treeitem" aria-expanded={open}>
      <Collapsible open={open} onOpenChange={setOpen}>
        {row}
        <CollapsibleContent>
          <ul role="group">
            {item.children!.map((child) => (
              <TreeNode
                key={child.id}
                item={child}
                currentId={currentId}
                setCurrentId={setCurrentId}
                level={level + 1}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}
