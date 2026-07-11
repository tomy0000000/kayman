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
