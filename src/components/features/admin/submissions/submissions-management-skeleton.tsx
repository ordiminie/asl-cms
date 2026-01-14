import {Card, CardContent, CardHeader} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'

export function SubmissionsManagementSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-56" />
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-[250px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({length: 5}).map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-4 rounded-lg border p-4"
            >
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48 flex-1" />
              <Skeleton className="hidden h-8 w-32 lg:block" />
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="h-6 w-16" />
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center space-x-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  )
}
