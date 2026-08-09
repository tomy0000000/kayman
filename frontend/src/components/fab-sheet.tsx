import { Plus } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'

import { ResponsiveSheet } from '@/components/responsive-sheet'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

interface FabSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hotkey: string
  label: string
  title: string
  className?: string
  children: React.ReactNode
}

export function FabSheet({
  open,
  onOpenChange,
  hotkey,
  label,
  title,
  className,
  children
}: FabSheetProps) {
  useHotkeys(hotkey, () => onOpenChange(true), { preventDefault: true })

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-lg"
            className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg"
            aria-label={label}
            onClick={() => onOpenChange(true)}
          >
            <Plus className="size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {label}
          <Kbd>{hotkey.toUpperCase()}</Kbd>
        </TooltipContent>
      </Tooltip>
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        className={className}
      >
        {children}
      </ResponsiveSheet>
    </>
  )
}
