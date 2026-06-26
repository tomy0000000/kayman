import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FabForm } from '@/components/fab-form'
import { FabSheet } from '@/components/fab-sheet'
import { TimePicker } from '@/components/time-picker'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { type EventCreate, type EventType, createEvent } from '@/lib/client'
import type { Client } from '@/lib/client/client'
import { toLocalDateTimeInputValue } from '@/lib/utils'

const EVENT_TYPES: EventType[] = ['Expense', 'Income', 'Transfer', 'Exchange']

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
  const [timestampLocal, setTimestampLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date())
  )

  const reset = () => {
    setType('Expense')
    setDescription('')
    setTimestampLocal(toLocalDateTimeInputValue(new Date()))
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: EventCreate) => {
      const response = await createEvent({ client, body })
      if (response.error) throw new Error('Failed to create event')
      if (!response.data) throw new Error('No data returned')
      return response.data
    },
    onSuccess: () => {
      toast.success('Event created')
      queryClient.invalidateQueries({ queryKey: ['events'] })
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
      timestamp: timestampLocal,
      timezone: browserTimezone,
      description: description.trim() || null
    })

  return (
    <FabSheet open={open} onOpenChange={setOpen} hotkey="n" label="New event">
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
          <FieldLabel htmlFor="event-type">Type</FieldLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id="event-type"
                type="button"
                variant="outline"
                className="w-full justify-between"
              >
                <span className="font-medium">{type}</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-(--radix-dropdown-menu-trigger-width)"
            >
              {EVENT_TYPES.map((eventType) => (
                <DropdownMenuItem
                  key={eventType}
                  onSelect={() => setType(eventType)}
                >
                  {eventType}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Field>

        <Field>
          <FieldLabel htmlFor="event-timestamp">Timestamp</FieldLabel>
          <TimePicker
            id="event-timestamp"
            value={timestampLocal}
            onChange={setTimestampLocal}
          />
        </Field>
      </FabForm>
    </FabSheet>
  )
}
