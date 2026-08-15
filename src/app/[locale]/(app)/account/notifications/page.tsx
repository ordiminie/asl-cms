import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import NotificationsContent from './notifications-content'
import NotificationsSkeleton from './notifications-skeleton'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

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
