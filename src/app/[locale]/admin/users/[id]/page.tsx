import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {withAuthAdmin} from '@/components/features/auth/with-auth'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'

import UserDetailContent from './user-detail-content'

export const metadata: Metadata = {
  title: 'Détails utilisateur',
  description: 'Détails et modification des informations utilisateur',
}

interface UserDetailPageProps {
  params: Promise<{
    id: string
  }>
}

function UserDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({length: 8}).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

async function UserDetailPage({params}: UserDetailPageProps) {
  const {id} = await params

  if (!id || typeof id !== 'string') {
    notFound()
  }

  return (
    <div className="bg-background">
      <Suspense fallback={<UserDetailSkeleton />}>
        <UserDetailContent userId={id} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(UserDetailPage)
