import type {
  CategoryRead,
  CategoryReadWithChildren,
  EventEntryRead
} from '@/lib/client'

export type TreeItem = {
  id: string
  label: string
  children?: TreeItem[]
}

// An entry row being edited in the event sheet. `id` is null for a row added in
// the sheet, which is created on submit; a row already on the event carries its
// id and is patched instead. Amount and quantity stay strings while typing;
// `key` is client-only and keeps a row's identity stable across reorders.
export type EventEntryDraft = {
  key: string
  id: number | null
  categoryId: number | null
  amount: string
  quantity: string
  currencyCode: string | null
  description: string
}

// A transaction row being edited in the event sheet. `id` is null for a row
// added in the sheet, which is created on submit; a row that came from an
// existing transaction (linked, seeded, or already on the event) carries its
// id and is patched instead. Amount stays a string while typing; `key` is
// client-only and keeps a row's identity stable across reorders.
export type TransactionDraft = {
  key: string
  id: number | null
  accountId: number | null
  amount: string
  tagIds: number[]
}

// What the event form hands back per transaction row, once the row is complete.
export type TransactionPayload = {
  id: number | null
  account_id: number
  amount: string
  tag_ids: number[]
  index: number
}

// What the event form hands back per entry row, once the row is complete. `id`
// is null for a row added in the sheet; `index` is the row's final position.
export type EventEntryPayload = {
  id: number | null
  category_id: number
  amount: string
  quantity: number
  currency_code: string
  description: string | null
  index: number
}

let componentKeyCount = 0

export function componentKey(): string {
  componentKeyCount += 1
  return `component-${componentKeyCount}`
}

// Strips a draft's identity so submitting creates a new row instead of patching
// the row it was copied from. Used when seeding a new event from an existing one.
export function detachDraft<T extends { key: string; id: number | null }>(
  draft: T
): T {
  return { ...draft, key: componentKey(), id: null }
}

export function toTransactionDraft(transaction: {
  id: number
  account_id: number
  amount: string
  tags?: { id: number }[]
}): TransactionDraft {
  return {
    key: String(transaction.id),
    id: transaction.id,
    accountId: transaction.account_id,
    amount: transaction.amount,
    tagIds: (transaction.tags ?? []).map(({ id }) => id)
  }
}

export function toEventEntryDraft(entry: EventEntryRead): EventEntryDraft {
  return {
    key: String(entry.id),
    id: entry.id,
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

// Group a flat category list into combobox groups: one group per root
// category, holding the root and its descendants in pre-order. The list
// arrives sorted by (index, name), which preserves sibling order.
export function buildCategoryGroups(
  categories: CategoryRead[]
): CategoryGroup[] {
  const childrenByParent = new Map<number, CategoryRead[]>()
  const roots: CategoryRead[] = []
  for (const category of categories) {
    if (category.parent_id == null) {
      roots.push(category)
    } else {
      const siblings = childrenByParent.get(category.parent_id) ?? []
      siblings.push(category)
      childrenByParent.set(category.parent_id, siblings)
    }
  }
  const walk = (category: CategoryRead): CategoryOption[] => {
    const options: CategoryOption[] = [
      { value: category.id, label: category.name }
    ]
    for (const child of childrenByParent.get(category.id) ?? []) {
      options.push(...walk(child))
    }
    return options
  }
  return roots.map((root) => ({ value: root.name, items: walk(root) }))
}
