import { Skeleton } from '@/components/ui/skeleton'

// Shaped like EventReceipt: a centered header, a couple of entry lines with a
// total, then the transaction lines. Shown while a receipt opened by id is
// still fetching its event.
export function EventReceiptSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <SkeletonLine key={index} />
        ))}
        <div className="flex justify-between gap-4 border-t border-dashed pt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      <div className="border-t" />

      <div className="flex flex-col gap-3">
        <SkeletonLine />
        <div className="flex justify-between gap-4 border-t border-dashed pt-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

function SkeletonLine() {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
