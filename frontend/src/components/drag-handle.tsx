import { GripVertical } from 'lucide-react'
import { type DragControls } from 'motion/react'

interface DragHandleProps {
  dragControls: DragControls
}

export function DragHandle({ dragControls }: DragHandleProps) {
  return (
    <span
      aria-label="Drag to reorder"
      className="flex cursor-grab touch-none items-center text-muted-foreground select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        e.preventDefault()
        dragControls.start(e)
      }}
    >
      <GripVertical className="size-4" />
    </span>
  )
}
