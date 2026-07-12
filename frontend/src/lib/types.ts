import type { CategoryReadWithChildren } from '@/lib/client'

export type TreeItem = {
  id: string
  label: string
  children?: TreeItem[]
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
