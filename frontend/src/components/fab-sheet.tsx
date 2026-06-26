import { Plus } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
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
  children: React.ReactNode
}

export function FabSheet({
  open,
  onOpenChange,
  hotkey,
  label,
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
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
