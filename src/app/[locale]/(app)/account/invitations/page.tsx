import {notFound} from 'next/navigation'

import {getUserInvitationsServiceDal} from '@/app/dal/organization-dal'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import InvitationsContent from './invitations-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export default async function Page() {
  if (!isPageEnabled(PagesConst.INVITATION)) {
    return notFound()
  }

  const invitations = await getUserInvitationsServiceDal()
  return <InvitationsContent invitationsUser={invitations} />
}
