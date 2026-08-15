import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import NotificationsContent from './notifications-content'
import NotificationsSkeleton from './notifications-skeleton'

export default function NotificationsPage() {
  if (!isPageEnabled(PagesConst.NOTIFICATIONS)) {
    return notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Restez informé de toutes vos activités et mises à jour importantes.
        </p>
      </div>

      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsContent />
      </Suspense>
    </div>
  )
}
