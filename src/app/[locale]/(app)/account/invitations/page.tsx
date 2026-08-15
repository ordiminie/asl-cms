import {notFound} from 'next/navigation'

import {getUserInvitationsServiceDal} from '@/app/dal/organization-dal'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import InvitationsContent from './invitations-content'

export default async function Page() {
  if (!isPageEnabled(PagesConst.INVITATION)) {
    return notFound()
  }

  const invitations = await getUserInvitationsServiceDal()
  return <InvitationsContent invitationsUser={invitations} />
}
