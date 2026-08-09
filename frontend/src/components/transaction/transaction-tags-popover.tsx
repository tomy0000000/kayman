import { Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger
} from '@/components/ui/popover'
import { type TransactionTagRead } from '@/lib/client'

interface TransactionTagsPopoverProps {
  tags: TransactionTagRead[]
  value: number[]
  onValueChange: (value: number[]) => void
}

export function TransactionTagsPopover({
  tags,
  value,
  onValueChange
}: TransactionTagsPopoverProps) {
  const hasTags = value.length > 0
  // An archived tag is kept out of the list unless the transaction already
  // carries it, so editing an old row never silently drops one.
  const options = tags.filter((tag) => !tag.archived || value.includes(tag.id))

  const toggleTag = (id: number) =>
    onValueChange(
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id]
    )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={hasTags ? 'Edit tags' : 'Add tags'}
        >
          <Tag />
          {hasTags && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="max-h-72 overflow-y-auto"
      >
        {options.length === 0 ? (
          <PopoverDescription>No tags</PopoverDescription>
        ) : (
          options.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2.5">
              <Checkbox
                checked={value.includes(tag.id)}
                onCheckedChange={() => toggleTag(tag.id)}
              />
              {tag.name}
            </label>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}
