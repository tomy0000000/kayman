import { Plus } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface FabSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hotkey: string
  label: string
  className?: string
  children: React.ReactNode
}

export function FabSheet({
  open,
  onOpenChange,
  hotkey,
  label,
  className,
  children
}: FabSheetProps) {
  useHotkeys(hotkey, () => onOpenChange(true), { preventDefault: true })

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              size="icon-lg"
              className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg"
              aria-label={label}
            >
              <Plus className="size-6" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          {label}
          <Kbd>{hotkey.toUpperCase()}</Kbd>
        </TooltipContent>
      </Tooltip>
      <SheetContent
        side="right"
        className={cn('flex flex-col', className)}
        onFocusOutside={(event) => event.preventDefault()}
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}
