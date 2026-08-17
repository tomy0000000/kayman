import { Plus } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

interface FabProps {
  hotkey: string
  label: string
  onOpen: () => void
}

export function Fab({ hotkey, label, onOpen }: FabProps) {
  useHotkeys(hotkey, () => onOpen(), { preventDefault: true })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-lg"
          className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg"
          aria-label={label}
          onClick={onOpen}
        >
          <Plus className="size-6" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {label}
        <Kbd>{hotkey.toUpperCase()}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
