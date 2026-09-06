import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { type EventSheetState } from '@/components/event/event-sheet'
import { toast } from '@/components/ui/toast'
import {
  type EventCreate,
  type EventReadDetailed,
  createEvent,
  updateEvent
} from '@/lib/client'
import {
  deleteEventMutation,
  readAccountsOptions,
  readCategoriesOptions,
  readCurrenciesOptions,
  readEventsQueryKey,
  readTransactionTagsOptions,
  readTransactionsQueryKey
} from '@/lib/client/@tanstack/react-query.gen'
import { type Client } from '@/lib/client/client'
import { REFERENCE_STALE_TIME } from '@/lib/constants'
import { syncEventEntries } from '@/lib/event-entries'
import { hasEventChanges, syncEventTransactions } from '@/lib/events'
import { type EventEntryPayload, type TransactionPayload } from '@/lib/types'

// Everything a page listing events needs to act on a row: the create/edit
// sheet, the delete confirmation, and the reference data both of them read.
// Routes still own the rendering (and what a page shows around it), they just
// share this wiring instead of repeating it.
export function useEventActions(client: Client) {
  const queryClient = useQueryClient()

  // The state outlives `open` so the sheet keeps its body while closing.
  const [sheet, setSheet] = useState<{
    open: boolean
    state: EventSheetState
  }>({ open: false, state: { mode: 'new' } })

  const editingEvent = sheet.state.mode === 'edit' ? sheet.state.event : null

  const openSheet = (state: EventSheetState) => setSheet({ open: true, state })

  const { mutate, isPending: isMutationPending } = useMutation({
    mutationFn: async ({
      body,
      transactions,
      entries
    }: {
      body: EventCreate
      transactions: TransactionPayload[]
      entries: EventEntryPayload[]
    }) => {
      let event: { id: number }
      if (!editingEvent) {
        const { data } = await createEvent({ client, body, throwOnError: true })
        event = data
      } else if (hasEventChanges(body, editingEvent)) {
        const { data } = await updateEvent({
          client,
          path: { event_id: editingEvent.id },
          body,
          throwOnError: true
        })
        event = data
      } else {
        // Only the transactions or entries changed, so the event needs no patch.
        event = editingEvent
      }

      await syncEventTransactions({
        client,
        eventId: event.id,
        transactions,
        previousTransactions: editingEvent?.transactions ?? [],
        createdAt: body.timestamp
      })

      await syncEventEntries({
        client,
        eventId: event.id,
        entries,
        previousEntries: editingEvent?.entries ?? []
      })

      return event
    },
    onSuccess: () => {
      toast.add({
        title: `Event ${editingEvent ? 'updated' : 'created'}`,
        type: 'success'
      })
      setSheet((current) => ({ ...current, open: false }))
    },
    // Settled, not success: the submit spans several calls, so a failure partway
    // can still have deleted or changed rows the table is now showing stale.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })
      queryClient.invalidateQueries({ queryKey: readTransactionsQueryKey() })
    },
    meta: {
      errorMessage: `Failed to ${editingEvent ? 'update' : 'create'} event`
    }
  })

  // The event outlives `open` so the dialog keeps its body while closing.
  const [deletion, setDeletion] = useState<{
    open: boolean
    event: EventReadDetailed | null
  }>({ open: false, event: null })

  const { mutate: mutateDelete, isPending: isDeletePending } = useMutation({
    ...deleteEventMutation(),
    onSuccess: () => {
      toast.add({ title: 'Event deleted', type: 'success' })
      setDeletion((current) => ({ ...current, open: false }))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: readEventsQueryKey() })
      queryClient.invalidateQueries({ queryKey: readTransactionsQueryKey() })
    },
    meta: { errorMessage: 'Failed to delete event' }
  })

  const isFormOpen = sheet.open && sheet.state.mode !== 'view'

  const { data: accounts } = useQuery({
    ...readAccountsOptions(),
    enabled: sheet.open
  })

  const { data: currencies } = useQuery({
    ...readCurrenciesOptions(),
    enabled: isFormOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  const { data: transactionTags } = useQuery({
    ...readTransactionTagsOptions(),
    enabled: isFormOpen,
    staleTime: REFERENCE_STALE_TIME
  })

  // Categories back both the form and the table's summary column.
  const { data: categories } = useQuery({
    ...readCategoriesOptions(),
    staleTime: REFERENCE_STALE_TIME
  })

  // An id -> name lookup so entries (which reference `category_id`) can render
  // names.
  const categoryNames = useMemo(
    () =>
      new Map(
        (categories ?? []).map((category) => [category.id, category.name])
      ),
    [categories]
  )

  return {
    categoryNames,
    openSheet,
    // Spread onto EventsTable.
    tableHandlers: {
      onEventView: (event: EventReadDetailed) =>
        openSheet({ mode: 'view', event }),
      onEventEdit: (event: EventReadDetailed) =>
        openSheet({ mode: 'edit', event }),
      onEventDuplicate: (event: EventReadDetailed) =>
        openSheet({ mode: 'duplicate', event }),
      onEventDelete: (event: EventReadDetailed) =>
        setDeletion({ open: true, event })
    },
    // Spread onto EventSheet. `seedDate` stays with the page, which is the only
    // one that knows which day a new event should default to.
    sheetProps: {
      open: sheet.open,
      state: sheet.state,
      onOpenChange: (open: boolean) =>
        setSheet((current) => ({ ...current, open })),
      accounts: accounts ?? [],
      categories: categories ?? [],
      categoryNames,
      currencies: currencies ?? [],
      transactionTags: transactionTags ?? [],
      onSubmit: (
        body: EventCreate,
        transactions: TransactionPayload[],
        entries: EventEntryPayload[]
      ) => mutate({ body, transactions, entries }),
      isPending: isMutationPending
    },
    // Spread onto EventDeleteDialog.
    deleteDialogProps: {
      open: deletion.open,
      onOpenChange: (open: boolean) =>
        setDeletion((current) => ({ ...current, open })),
      event: deletion.event,
      isPending: isDeletePending,
      onConfirm: () =>
        deletion.event && mutateDelete({ path: { id: deletion.event.id } })
    }
  }
}
