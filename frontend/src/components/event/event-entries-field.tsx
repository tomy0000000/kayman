import { Receipt, X } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { type ReactNode, type RefObject, useRef, useState } from 'react'

import { CategoryCombobox } from '@/components/category-combobox'
import { CurrencyAmountInput } from '@/components/currency-amount-input'
import { DescriptionPopover } from '@/components/description-popover'
import { DragHandle } from '@/components/drag-handle'
import { FieldEmpty } from '@/components/field-empty'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useClientCurrency } from '@/hooks/use-client-currency'
import { type CategoryRead, type CurrencyRead } from '@/lib/client'
import { spreadTax, taxableSubtotal } from '@/lib/tax'
import { type EventEntryDraft, componentKey } from '@/lib/types'
import { cn, formatCurrency, isAmount, sumByCurrency } from '@/lib/utils'

interface EventEntriesFieldProps {
  categories: CategoryRead[]
  currencies: CurrencyRead[]
  value: EventEntryDraft[]
  onChange: (value: EventEntryDraft[]) => void
}

interface EventEntryRowProps {
  entry: EventEntryDraft
  categories: CategoryRead[]
  currencies: CurrencyRead[]
  constraints: RefObject<HTMLTableSectionElement | null>
  // Undefined hides the taxable toggle, which only matters while tax is entered.
  taxable: boolean | undefined
  onTaxableChange: (taxable: boolean) => void
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

  const { currency: clientCurrency } = useClientCurrency()
  // The saved code may no longer exist in the app's currency table, so only
  // use the client currency when it does.
  const defaultCurrency = currencies.some((c) => c.code === clientCurrency)
    ? clientCurrency
    : null

  const [tax, setTax] = useState('')
  const [taxCurrencyCode, setTaxCurrencyCode] = useState<string | null>(null)
  const [untaxedKeys, setUntaxedKeys] = useState<Set<string>>(new Set())
  const [beforeSpread, setBeforeSpread] = useState<{
    entries: EventEntryDraft[]
    tax: string
    taxCurrencyCode: string
  } | null>(null)

  const taxCurrency =
    taxCurrencyCode ?? value.at(-1)?.currencyCode ?? defaultCurrency
  const spread =
    taxCurrency == null ? null : spreadTax(value, tax, taxCurrency, untaxedKeys)
  const taxBase =
    taxCurrency == null ? 0 : taxableSubtotal(value, taxCurrency, untaxedKeys)

  // Any edit after a spread makes its snapshot stale, so undo is dropped.
  const change = (next: EventEntryDraft[]) => {
    setBeforeSpread(null)
    onChange(next)
  }

  const applySpread = () => {
    if (!spread || taxCurrency == null) return
    setBeforeSpread({ entries: value, tax, taxCurrencyCode: taxCurrency })
    changeTax('')
    onChange(spread)
  }

  const undoSpread = () => {
    if (!beforeSpread) return
    setTax(beforeSpread.tax)
    setTaxCurrencyCode(beforeSpread.taxCurrencyCode)
    setBeforeSpread(null)
    onChange(beforeSpread.entries)
  }

  // The tax keeps the currency it started in, even if entries change theirs later.
  const changeTax = (next: string) => {
    setTax(next)
    setTaxCurrencyCode(next === '' ? null : taxCurrency)
  }

  const setTaxable = (key: string, taxable: boolean) => {
    const next = new Set(untaxedKeys)
    if (taxable) next.delete(key)
    else next.add(key)
    setUntaxedKeys(next)
  }

  const addEntry = () =>
    change([
      ...value,
      {
        key: componentKey(),
        id: null,
        categoryId: null,
        amount: '',
        quantity: '1',
        // Entries in one event usually share a currency.
        currencyCode: value.at(-1)?.currencyCode ?? defaultCurrency,
        description: ''
      }
    ])

  const updateEntry = (entry: EventEntryDraft) =>
    change(value.map((item) => (item.key === entry.key ? entry : item)))

  const removeEntry = (key: string) =>
    change(value.filter((item) => item.key !== key))

  // Rows still being filled in are left out rather than counted as zero.
  const totals = sumByCurrency(
    value.flatMap((entry) => {
      const amount = Number(entry.amount) * parseInt(entry.quantity, 10)
      return entry.amount !== '' &&
        entry.currencyCode != null &&
        Number.isFinite(amount)
        ? [{ amount, currencyCode: entry.currencyCode }]
        : []
    })
  )

  // Before a spread the tax is still separate, so the total adds it on.
  const grandTotals = new Map(totals)
  if (!beforeSpread && isAmount(tax) && taxCurrency != null) {
    grandTotals.set(
      taxCurrency,
      (grandTotals.get(taxCurrency) ?? 0) + Number(tax)
    )
  }

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
            onReorder={change}
            className="[&_tr:last-child]:border-0"
          >
            {value.map((entry) => (
              <EventEntryRow
                key={entry.key}
                entry={entry}
                categories={categories}
                currencies={currencies}
                constraints={body}
                taxable={tax === '' ? undefined : !untaxedKeys.has(entry.key)}
                onTaxableChange={(taxable) => setTaxable(entry.key, taxable)}
                onChange={updateEntry}
                onRemove={removeEntry}
              />
            ))}
          </Reorder.Group>
          <TableFooter>
            {!beforeSpread && totals.size > 0 && (
              <FooterRow label="Subtotal">
                <CurrencyTotals totals={totals} />
              </FooterRow>
            )}
            {beforeSpread ? (
              <FooterRow
                label={`${formatCurrency(Number(beforeSpread.tax), beforeSpread.taxCurrencyCode)} tax spread across the taxable entries`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={undoSpread}
                >
                  Undo
                </Button>
              </FooterRow>
            ) : (
              <FooterRow
                label={
                  <span className="flex flex-col">
                    <FieldLabel htmlFor="event-entries-tax">Tax</FieldLabel>
                    {isAmount(tax) && taxBase !== 0 && taxCurrency != null && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {((Number(tax) / taxBase) * 100).toFixed(3)}% of{' '}
                        {formatCurrency(taxBase, taxCurrency)}
                      </span>
                    )}
                  </span>
                }
              >
                <div className="flex items-center gap-2">
                  <div className="w-40">
                    <CurrencyAmountInput
                      id="event-entries-tax"
                      currencies={currencies}
                      currency={currencies.find((c) => c.code === taxCurrency)}
                      onCurrencyChange={setTaxCurrencyCode}
                      amount={tax}
                      onAmountChange={changeTax}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={spread == null}
                    onClick={applySpread}
                  >
                    Spread
                  </Button>
                </div>
              </FooterRow>
            )}
            {(beforeSpread || isAmount(tax)) && grandTotals.size > 0 && (
              <FooterRow label="Total">
                <CurrencyTotals totals={grandTotals} />
              </FooterRow>
            )}
          </TableFooter>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        Add entry
      </Button>
    </div>
  )
}

function FooterRow({
  label,
  children
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <TableRow>
      <TableCell colSpan={6}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="whitespace-normal">{label}</span>
          {children}
        </div>
      </TableCell>
    </TableRow>
  )
}

function CurrencyTotals({ totals }: { totals: Map<string, number> }) {
  return (
    <div className="flex flex-col items-end tabular-nums">
      {[...totals].map(([currencyCode, total]) => (
        <span key={currencyCode} className="whitespace-nowrap">
          {formatCurrency(total, currencyCode)}
        </span>
      ))}
    </div>
  )
}

function EventEntryRow({
  entry,
  categories,
  currencies,
  constraints,
  taxable,
  onTaxableChange,
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
        <div className="flex items-center gap-2">
          {taxable !== undefined && (
            <Button
              type="button"
              variant={taxable ? 'secondary' : 'ghost'}
              size="xs"
              aria-pressed={taxable}
              title={taxable ? 'Taxable' : 'Not taxable'}
              className={cn(!taxable && 'text-muted-foreground line-through')}
              onClick={() => onTaxableChange(!taxable)}
            >
              Tax
            </Button>
          )}
          <CurrencyAmountInput
            currencies={currencies}
            currency={currencies.find((c) => c.code === entry.currencyCode)}
            onCurrencyChange={(currencyCode) =>
              onChange({ ...entry, currencyCode })
            }
            amount={entry.amount}
            onAmountChange={(amount) => onChange({ ...entry, amount })}
          />
        </div>
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
