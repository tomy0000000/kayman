import {
  type DefaultError,
  type QueryKey,
  type UseMutationOptions,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'

export type OptimisticStatus = 'pending' | 'error'

export interface Optimistic<TVariables> {
  variables: TVariables
  status: OptimisticStatus
  retry: () => void
}

export function useOptimisticMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  queryKeys: QueryKey[]
) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    ...options,
    onSettled: async (...args) => {
      await Promise.all(
        queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
      await options.onSettled?.(...args)
    }
  })

  const { variables, isPending, isError, mutate } = mutation
  const optimistic: Optimistic<TVariables> | null =
    (isPending || isError) && variables !== undefined
      ? {
          variables,
          status: isError ? 'error' : 'pending',
          retry: () => mutate(variables)
        }
      : null

  return { ...mutation, optimistic }
}

export interface OptimisticRow<TItem> {
  key: string
  item: TItem
  status?: OptimisticStatus
  retry?: () => void
}

export function withOptimisticRow<TRow, TItem extends TRow, TVariables>(
  items: TItem[],
  keyOf: (item: TItem) => string,
  optimistic: Optimistic<TVariables> | null,
  toRow: (variables: TVariables) => TRow,
  compare?: (a: TRow, b: TRow) => number
): OptimisticRow<TRow>[] {
  const rows: OptimisticRow<TRow>[] = items.map((item) => ({
    key: keyOf(item),
    item
  }))
  if (optimistic)
    rows.push({
      key: 'optimistic',
      item: toRow(optimistic.variables),
      status: optimistic.status,
      retry: optimistic.retry
    })
  return compare ? rows.sort((a, b) => compare(a.item, b.item)) : rows
}
