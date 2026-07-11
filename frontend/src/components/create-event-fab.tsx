import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  type LucideIcon,
  Repeat,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FabForm } from '@/components/fab-form'
import { FabSheet } from '@/components/fab-sheet'
import { type SelectedTransaction } from '@/components/link-transactions-table'
import { LinkedTransactionsField } from '@/components/linked-transactions-field'
import { TimePicker } from '@/components/time-picker'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type EventCreate,
  type EventType,
  createEvent,
  updateTransactions
} from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { eventTypeTabActiveClass } from '@/lib/event-types'
import { cn, toLocalDateTimeInputValue } from '@/lib/utils'

const EVENT_TYPES: { value: EventType; icon: LucideIcon }[] = [
  { value: 'Expense', icon: TrendingDown },
  { value: 'Income', icon: TrendingUp },
  { value: 'Transfer', icon: ArrowLeftRight },
  { value: 'Exchange', icon: Repeat }
]

const browserTimezone = Intl.DateTimeFormat().resolvedOptions()
  .timeZone as EventCreate['timezone']

interface CreateEventFabProps {
  client: Client
}

export function CreateEventFab({ client }: CreateEventFabProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<EventType>('Expense')
  const [description, setDescription] = useState('')
  const [timestamp, setTimestamp] = useState(() => new Date())
  const [linkedTransactions, setLinkedTransactions] = useState<
    SelectedTransaction[]
  >([])

  const reset = () => {
    setType('Expense')
    setDescription('')
    setTimestamp(new Date())
    setLinkedTransactions([])
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: EventCreate) => {
      const response = await createEvent({ client, body })
      if (response.error) throw new Error('Failed to create event')
      if (!response.data) throw new Error('No data returned')
      const event = response.data

      if (linkedTransactions.length > 0) {
        const linkResponse = await updateTransactions({
          client,
          body: linkedTransactions.map(({ transaction }) => ({
            id: transaction.id,
            event_id: event.id
          }))
        })
        if (linkResponse.error) throw new Error('Failed to link transactions')
      }

      return event
    },
    onSuccess: () => {
      toast.success('Event created')
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      reset()
      setOpen(false)
    },
    onError: (error) => {
      console.error(error)
      toast.error('Failed to create event', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })

  const handleCreate = () =>
    mutate({
      type,
      timestamp: toLocalDateTimeInputValue(timestamp),
      timezone: browserTimezone,
      description: description.trim() || null
    })

  return (
    <FabSheet open={open} onOpenChange={setOpen} hotkey="n" label="New event">
      <SheetHeader>
        <SheetTitle>New event</SheetTitle>
      </SheetHeader>
      <FabForm onSubmit={handleCreate} isPending={isPending}>
        <Field>
          <FieldLabel htmlFor="event-description">Description</FieldLabel>
          <Input
            id="event-description"
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel>Type</FieldLabel>
          <Tabs
            value={type}
            onValueChange={(value) => setType(value as EventType)}
          >
            <TabsList className="w-full">
              {EVENT_TYPES.map(({ value, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    'gap-1 px-1 text-xs',
                    eventTypeTabActiveClass[value]
                  )}
                >
                  <Icon />
                  {value}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>

        <Field>
          <FieldLabel htmlFor="event-timestamp">Timestamp</FieldLabel>
          <TimePicker
            id="event-timestamp"
            value={timestamp}
            onChange={setTimestamp}
          />
        </Field>

        <Field>
          <FieldLabel>Transactions</FieldLabel>
          <LinkedTransactionsField
            client={client}
            value={linkedTransactions}
            onChange={setLinkedTransactions}
          />
        </Field>
      </FabForm>
    </FabSheet>
  )
}
