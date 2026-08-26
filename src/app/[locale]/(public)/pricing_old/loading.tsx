import {Skeleton} from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="bg-background min-h-screen py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header section */}
        <div className="mb-12 space-y-4 text-center">
          <Skeleton className="mx-auto h-12 w-96" />
          <Skeleton className="mx-auto h-6 w-[600px]" />

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-8 pt-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>

        {/* Pricing cards grid */}
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({length: 4}).map((_, index) => (
            <div key={index} className="bg-card relative rounded-lg border p-6">
              {/* Card Header */}
              <div className="mb-6 space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>

              {/* Price */}
              <div className="mb-6 space-y-2">
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-4 w-20" />
                {index > 0 && <Skeleton className="h-4 w-24" />}
                {index > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                )}
              </div>

              {/* Features list */}
              <div className="mb-6 space-y-3">
                {Array.from({length: 4}).map((_, featureIndex) => (
                  <div key={featureIndex} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>

              {/* Button */}
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
