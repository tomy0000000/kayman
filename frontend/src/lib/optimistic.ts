import {
  type DefaultError,
  type QueryKey,
  type UseMutationOptions,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'

export const PLACEHOLDER_ID = -1

interface Snapshots {
  snapshots: [QueryKey, unknown][]
}

export interface CacheUpdate<TVariables, TData = unknown> {
  queryKey: QueryKey
  update?: (current: TData, variables: TVariables) => TData
}

export function cacheUpdate<TData, TVariables>(
  queryKey: QueryKey,
  update: (current: TData, variables: TVariables) => TData
): CacheUpdate<TVariables> {
  return { queryKey, update: update as CacheUpdate<TVariables>['update'] }
}

export function useOptimisticMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void
>(
  options: Omit<
    UseMutationOptions<TData, TError, TVariables, Snapshots>,
    'onMutate'
  >,
  updates: CacheUpdate<TVariables>[]
) {
  const queryClient = useQueryClient()
  return useMutation<TData, TError, TVariables, Snapshots>({
    ...options,
    onMutate: async (variables) => {
      const snapshots: Snapshots['snapshots'] = []
      for (const { queryKey, update } of updates) {
        // Cancelled so an in-flight refetch cannot overwrite the prediction.
        await queryClient.cancelQueries({ queryKey })
        if (!update) continue
        for (const [key, data] of queryClient.getQueriesData({ queryKey })) {
          if (data === undefined) continue
          snapshots.push([key, data])
          queryClient.setQueryData(key, update(data, variables))
        }
      }
      return { snapshots }
    },
    onError: (...args) => {
      const [, , context] = args
      for (const [key, data] of context?.snapshots ?? [])
        queryClient.setQueryData(key, data)
      return options.onError?.(...args)
    },
    onSettled: (...args) => {
      for (const { queryKey } of updates)
        queryClient.invalidateQueries({ queryKey })
      return options.onSettled?.(...args)
    }
  })
}
