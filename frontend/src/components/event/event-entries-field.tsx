import { Receipt, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { type RefObject, useRef } from 'react'

import { CategoryCombobox } from '@/components/category-combobox'
import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { DescriptionPopover } from '@/components/description-popover'
import { DragHandle } from '@/components/drag-handle'
import { FieldEmpty } from '@/components/field-empty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { type CategoryReadWithChildren, type CurrencyRead } from '@/lib/client'
import { type EventEntryDraft, componentKey } from '@/lib/types'

interface EventEntriesFieldProps {
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  value: EventEntryDraft[]
  onChange: (value: EventEntryDraft[]) => void
}

interface EventEntryRowProps {
  entry: EventEntryDraft
  categories: CategoryReadWithChildren[]
  currencies: CurrencyRead[]
  constraints: RefObject<HTMLTableSectionElement | null>
  onChange: (entry: EventEntryDraft) => void
  onRemove: (key: string) => void
}

export function EventEntriesField({
  categories,
  currencies,
  value,
  onChange
}: EventEntriesFieldProps) {
  // A row dragged past the table is clipped by the scroll container `Table`
  // wraps it in, so keep the drag inside the body.
  const body = useRef<HTMLTableSectionElement>(null)

  const addEntry = () =>
    onChange([
      ...value,
      {
        key: componentKey(),
        id: null,
        categoryId: null,
        amount: '',
        quantity: '1',
        // Entries in one event usually share a currency.
        currencyCode: value.at(-1)?.currencyCode ?? null,
        description: ''
      }
    ])

  const updateEntry = (entry: EventEntryDraft) =>
    onChange(value.map((item) => (item.key === entry.key ? entry : item)))

  const removeEntry = (key: string) =>
    onChange(value.filter((item) => item.key !== key))

  if (value.length === 0) {
    return (
      <FieldEmpty
        icon={Receipt}
        title="No entries"
        description="Itemize this event with one or more entries."
      >
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          Add entry
        </Button>
      </FieldEmpty>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader className="max-sm:hidden">
            <TableRow>
              <TableHead className="w-6 px-0" />
              <TableHead>Category</TableHead>
              <TableHead className="w-56">Amount</TableHead>
              <TableHead className="w-16">Qty</TableHead>
              <TableHead className="w-8 px-0" />
              <TableHead className="w-8 px-0" />
            </TableRow>
          </TableHeader>
          <Reorder.Group
            as="tbody"
            ref={body}
            axis="y"
            values={value}
            onReorder={onChange}
            className="[&_tr:last-child]:border-0"
          >
            {value.map((entry) => (
              <EventEntryRow
                key={entry.key}
                entry={entry}
                categories={categories}
                currencies={currencies}
                constraints={body}
                onChange={updateEntry}
                onRemove={removeEntry}
              />
            ))}
          </Reorder.Group>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        Add entry
      </Button>
    </div>
  )
}

function EventEntryRow({
  entry,
  categories,
  currencies,
  constraints,
  onChange,
  onRemove
}: EventEntryRowProps) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="tr"
      value={entry}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraints}
      dragElastic={0}
      className="relative border-b bg-background max-sm:grid max-sm:grid-cols-[auto_1fr_auto_auto_auto] max-sm:items-center"
    >
      <TableCell className="px-0 max-sm:row-span-2">
        <DragHandle dragControls={dragControls} className="max-sm:px-2" />
      </TableCell>
      <TableCell className="max-sm:col-span-3">
        <CategoryCombobox
          categories={categories}
          value={entry.categoryId}
          onValueChange={(categoryId) => onChange({ ...entry, categoryId })}
        />
      </TableCell>
      <TableCell className="max-sm:col-start-2">
        <CurrencyAmountInput
          currencies={currencies}
          currency={currencies.find((c) => c.code === entry.currencyCode)}
          onCurrencyChange={(currencyCode) =>
            onChange({ ...entry, currencyCode })
          }
          amount={entry.amount}
          onAmountChange={(amount) => onChange({ ...entry, amount })}
        />
      </TableCell>
      <TableCell className="max-sm:w-20">
        <Input
          type="number"
          min={1}
          step={1}
          value={entry.quantity}
          onChange={(e) => onChange({ ...entry, quantity: e.target.value })}
        />
      </TableCell>
      <TableCell className="px-0">
        <DescriptionPopover
          value={entry.description}
          onValueChange={(description) => onChange({ ...entry, description })}
        />
      </TableCell>
      <TableCell className="px-0 max-sm:col-start-5 max-sm:row-span-2 max-sm:row-start-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove entry"
          onClick={() => onRemove(entry.key)}
        >
          <X />
        </Button>
      </TableCell>
    </Reorder.Item>
  )
}
