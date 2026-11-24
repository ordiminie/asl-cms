import type {MemberInvitationStateDTO} from '@/services/types/domain/member-profile-types'

/** Les deux traces d'une adresse sur une association (s42a). */
export type InvitationTraces = {
  lastInvitedAt: Date | null
  firstSignedInAt: Date | null
}

/**
 * L'etat de l'invitation d'une adresse : la premiere connexion prime sur
 * l'invitation, qui prime sur l'absence de trace.
 */
export const invitationStateOf = (
  traces: InvitationTraces | undefined
): MemberInvitationStateDTO => {
  if (traces?.firstSignedInAt) {
    return {state: 'signed_in', at: traces.firstSignedInAt.toISOString()}
  }
  if (traces?.lastInvitedAt) {
    return {state: 'invited', at: traces.lastInvitedAt.toISOString()}
  }
  return {state: 'never', at: null}
}
