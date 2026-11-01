import { ListFilter } from 'lucide-react'
import { type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface TableEnumFilterProps<T extends string> {
  label: string
  options: readonly T[]
  selected: T[]
  onSelectedChange: (selected: T[]) => void
  renderOption?: (option: T) => ReactNode
}

export function TableEnumFilter<T extends string>({
  label,
  options,
  selected,
  onSelectedChange,
  renderOption = (option) => option
}: TableEnumFilterProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2.5">
          {label}
          <ListFilter
            className={cn(selected.length < options.length && 'text-primary')}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            onCheckedChange={(checked) =>
              onSelectedChange(
                options.filter((o) =>
                  o === option ? checked : selected.includes(o)
                )
              )
            }
            onSelect={(event) => event.preventDefault()}
          >
            {renderOption(option)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
