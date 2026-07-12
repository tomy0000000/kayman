import type { CategoryReadWithChildren, EventEntryRead } from '@/lib/client'

export type TreeItem = {
  id: string
  label: string
  children?: TreeItem[]
}

// An entry row being edited in the event sheet. Amount and quantity stay
// strings while typing; `key` is client-only and keeps a row's identity stable
// across reorders, since a row has no id until it is created.
export type EventEntryDraft = {
  key: string
  categoryId: number | null
  amount: string
  quantity: string
  currencyCode: string | null
  description: string
}

export function toEventEntryDraft(entry: EventEntryRead): EventEntryDraft {
  return {
    key: String(entry.id),
    categoryId: entry.category_id,
    amount: entry.amount,
    quantity: String(entry.quantity),
    currencyCode: entry.currency_code,
    description: entry.description ?? ''
  }
}

export function categoryToTreeItem(
  category: CategoryReadWithChildren,
  parentId?: string | null
): TreeItem {
  const id = parentId ? `${parentId}-${category.id}` : String(category.id)
  const children: TreeItem[] = []
  if (category.sub_categories) {
    for (const subCategory of category.sub_categories) {
      children.push(categoryToTreeItem(subCategory, id))
    }
  }
  return { id, label: category.name, children }
}

export type CategoryOption = {
  value: number
  label: string
}

export type CategoryGroup = {
  value: string
  items: CategoryOption[]
}

// Flatten a category tree into combobox groups: one group per root category,
// whose items are the root and all its descendants, each labelled by its path
// ("Food / Groceries"). Disabled categories and their subtrees are omitted.
export function buildCategoryGroups(
  categories: CategoryReadWithChildren[]
): CategoryGroup[] {
  const walk = (
    category: CategoryReadWithChildren,
    path: string[]
  ): CategoryOption[] => {
    if (category.disabled) return []
    const labelPath = [...path, category.name]
    const options: CategoryOption[] = [
      { value: category.id, label: labelPath.join(' / ') }
    ]
    for (const subCategory of category.sub_categories ?? []) {
      options.push(...walk(subCategory, labelPath))
    }
    return options
  }
  return categories.flatMap((root) => {
    const items = walk(root, [])
    return items.length > 0 ? [{ value: root.name, items }] : []
  })
}

// Flatten a category tree into an id -> name lookup, including nested
// sub-categories, so entries (which reference `category_id`) can render names.
export function buildCategoryNameMap(
  categories: CategoryReadWithChildren[]
): Map<number, string> {
  const map = new Map<number, string>()
  const walk = (list: CategoryReadWithChildren[]) => {
    for (const category of list) {
      map.set(category.id, category.name)
      if (category.sub_categories) walk(category.sub_categories)
    }
  }
  walk(categories)
  return map
}
