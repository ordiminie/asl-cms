import {Skeleton} from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 pt-6 sm:p-8">
      <div className="flex items-center justify-between space-y-2">
        <Skeleton className="h-8 w-48" />
      </div>

      <div className="space-y-8">
        <div className="rounded-lg border p-4 sm:p-6">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="rounded-lg border p-4 sm:p-6">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
