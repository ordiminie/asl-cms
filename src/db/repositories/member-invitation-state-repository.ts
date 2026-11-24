import {and, eq, inArray, sql} from 'drizzle-orm'

import {memberInvitationState} from '@/db/models/member-invitation-state-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Traces d'invitation et de premiere connexion (s42a). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

/** Les traces d'un compte sur l'association. */
export type InvitationStateRowModel = {
  userId: string
  lastInvitedAt: Date | null
  firstSignedInAt: Date | null
}

type TraceInput = {organizationId: string; userId: string; at: Date}

/** Ecrit la date du dernier envoi d'invitation parti (remplace la precedente). */
export const markInvitedTxnDao = async ({
  organizationId,
  userId,
  at,
}: TraceInput): Promise<void> => {
  await getDb()
    .insert(memberInvitationState)
    .values({organizationId, userId, lastInvitedAt: at})
    .onConflictDoUpdate({
      target: [
        memberInvitationState.organizationId,
        memberInvitationState.userId,
      ],
      set: {lastInvitedAt: sql`excluded."last_invited_at"`},
    })
}

/**
 * Ecrit la premiere connexion reussie, **seulement si elle est encore nulle** :
 * une connexion suivante ne la deplace jamais.
 */
export const markFirstSignInTxnDao = async ({
  organizationId,
  userId,
  at,
}: TraceInput): Promise<void> => {
  await getDb()
    .insert(memberInvitationState)
    .values({organizationId, userId, firstSignedInAt: at})
    .onConflictDoUpdate({
      target: [
        memberInvitationState.organizationId,
        memberInvitationState.userId,
      ],
      set: {
        firstSignedInAt: sql`coalesce(${memberInvitationState.firstSignedInAt}, excluded."first_signed_in_at")`,
      },
    })
}

/** Les traces des comptes demandes sur l'association ; rien sans compte. */
export const getInvitationStatesByUserIdsDao = async (
  organizationId: string,
  userIds: readonly string[]
): Promise<InvitationStateRowModel[]> => {
  if (userIds.length === 0) return []
  return getDb()
    .select({
      userId: memberInvitationState.userId,
      lastInvitedAt: memberInvitationState.lastInvitedAt,
      firstSignedInAt: memberInvitationState.firstSignedInAt,
    })
    .from(memberInvitationState)
    .where(
      and(
        eq(memberInvitationState.organizationId, organizationId),
        inArray(memberInvitationState.userId, [...userIds])
      )
    )
}
