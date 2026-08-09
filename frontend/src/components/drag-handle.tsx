import { GripVertical } from 'lucide-react'
import { type DragControls } from 'motion/react'

import { cn } from '@/lib/utils'

interface DragHandleProps {
  dragControls: DragControls
  className?: string
}

export function DragHandle({ dragControls, className }: DragHandleProps) {
  return (
    <span
      aria-label="Drag to reorder"
      className={cn(
        'flex cursor-grab touch-none items-center text-muted-foreground select-none active:cursor-grabbing',
        className
      )}
      onPointerDown={(e) => {
        e.preventDefault()
        dragControls.start(e)
      }}
    >
      <GripVertical className="size-4" />
    </span>
  )
}
