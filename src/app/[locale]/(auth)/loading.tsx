import {Skeleton} from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Logo/Brand header */}
        <div className="flex flex-col gap-6 text-center">
          <div className="flex items-center gap-2 self-center font-medium">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>

        {/* Login form card */}
        <div className="bg-card text-card-foreground rounded-lg border shadow-sm">
          {/* Card header */}
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Card content */}
          <div className="p-6 pt-0">
            <div className="grid gap-6">
              {/* Social login buttons */}
              <div className="grid gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>

              {/* Divider */}
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <Skeleton className="bg-background relative z-10 h-4 w-32 px-2" />
              </div>

              {/* Login form */}
              <div className="grid gap-6">
                <div className="grid gap-3">
                  {/* Email field */}
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-10 w-full" />
                  </div>

                  {/* Password field */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>

                {/* Submit button */}
                <Skeleton className="h-10 w-full" />

                {/* Sign up link */}
                <div className="text-center text-sm">
                  <Skeleton className="mx-auto h-4 w-40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="text-muted-foreground text-center text-xs text-balance">
          <Skeleton className="mx-auto h-3 w-64" />
        </div>
      </div>
    </div>
  )
}
