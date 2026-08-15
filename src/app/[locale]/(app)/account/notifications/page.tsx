import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import NotificationsContent from './notifications-content'
import NotificationsSkeleton from './notifications-skeleton'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
