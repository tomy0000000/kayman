import { useMemo } from 'react'

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  useComboboxAnchor
} from '@/components/ui/combobox'
import { type CategoryRead } from '@/lib/client'
import {
  type CategoryGroup,
  type CategoryOption,
  buildCategoryGroups
} from '@/lib/types'

interface CategoryComboboxProps {
  categories: CategoryRead[]
  value: number | null
  onValueChange: (categoryId: number | null) => void
  id?: string
}

export function CategoryCombobox({
  categories,
  value,
  onValueChange,
  id
}: CategoryComboboxProps) {
  const anchor = useComboboxAnchor()
  const groups = useMemo(() => buildCategoryGroups(categories), [categories])
  const selected =
    groups
      .flatMap((group) => group.items)
      .find((option) => option.value === value) ?? null

  return (
    <Combobox
      id={id}
      items={groups}
      value={selected}
      onValueChange={(option: CategoryOption | null) =>
        onValueChange(option?.value ?? null)
      }
    >
      <div ref={anchor}>
        <ComboboxInput placeholder="Select category" />
      </div>
      <ComboboxContent anchor={anchor} className="min-w-0">
        <ComboboxEmpty>No category found.</ComboboxEmpty>
        <ComboboxList>
          {(group: CategoryGroup, index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(category: CategoryOption) => (
                  <ComboboxItem key={category.value} value={category}>
                    {category.label}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
              {index < groups.length - 1 && <ComboboxSeparator />}
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
