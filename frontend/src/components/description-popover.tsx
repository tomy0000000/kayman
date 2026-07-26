import { TextAlignStart } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'

interface DescriptionPopoverProps {
  value: string
  onValueChange: (value: string) => void
}

export function DescriptionPopover({
  value,
  onValueChange
}: DescriptionPopoverProps) {
  const hasDescription = value.trim().length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={hasDescription ? 'Edit description' : 'Add description'}
        >
          <TextAlignStart />
          {hasDescription && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end">
        <Textarea
          placeholder="Description"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </PopoverContent>
    </Popover>
  )
}
