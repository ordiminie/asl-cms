import {notFound} from 'next/navigation'

import {getUserInvitationsServiceDal} from '@/app/dal/organization-dal'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import InvitationsContent from './invitations-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

export default async function Page() {
  if (!isPageEnabled(PagesConst.INVITATION)) {
    return notFound()
  }

  const invitations = await getUserInvitationsServiceDal()
  return <InvitationsContent invitationsUser={invitations} />
}
