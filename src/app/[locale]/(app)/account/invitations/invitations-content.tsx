'use client'

import {useState} from 'react'

import {useOrganizationRole} from '@/components/context/organization-provider'
import {InvitationWithUser} from '@/services/types/domain/organization-types'

import InvitationsOrganization from './invitations-organization'
import InvitationsUsers from './invitations-user'

export type PartialInvitationWithUser = Partial<
  Omit<InvitationWithUser, 'id'>
> & {
  id: string
}

// Composant principal qui orchestre les deux tableaux
export default function InvitationsContent({
  invitationsUser,
}: {
  invitationsUser: PartialInvitationWithUser[]
}) {
  const {isOwner} = useOrganizationRole()

  const [invitations, setInvitations] = useState<PartialInvitationWithUser[]>(
    invitationsUser || []
  )

  const handleInvitationUpdate = (invitationId: string) => {
    setInvitations(invitations.filter((inv) => inv.id !== invitationId))
  }

  return (
    <div className="space-y-6">
      {/* Tableau des invitations reçues - Toujours visible */}
      <InvitationsUsers
        invitations={invitations}
        onInvitationUpdate={handleInvitationUpdate}
      />

      {/* Tableau des invitations envoyées - Visible uniquement si owner */}
      {isOwner && <InvitationsOrganization />}
    </div>
  )
}
