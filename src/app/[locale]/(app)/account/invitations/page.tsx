import {notFound} from 'next/navigation'

import {getUserInvitationsServiceDal} from '@/app/dal/organization-dal'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import InvitationsContent from './invitations-content'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

export default async function Page() {
  if (!isPageEnabled(PagesConst.INVITATION)) {
    return notFound()
  }

  const invitations = await getUserInvitationsServiceDal()
  return <InvitationsContent invitationsUser={invitations} />
}
