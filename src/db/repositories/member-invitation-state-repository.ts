import {and, eq, inArray, sql} from 'drizzle-orm'

import {user} from '@/db/models/auth-model'
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

/** Une adresse, son compte et les traces de ce compte sur l'association. */
export type InvitationStateByEmailRowModel = InvitationStateRowModel & {
  /** L'adresse du compte, en minuscules. */
  email: string
}

/**
 * Les traces des adresses demandees (s42b, ADR 072) : chaque adresse, sans
 * casse, relie a son compte, puis aux traces de ce compte sur l'association.
 * Une adresse sans compte ne rend rien.
 */
export const getInvitationStatesByEmailsDao = async (
  organizationId: string,
  emails: readonly string[]
): Promise<InvitationStateByEmailRowModel[]> => {
  const keys = [...new Set(emails.map((email) => email.trim().toLowerCase()))]
  if (keys.length === 0) return []
  return getDb()
    .select({
      email: sql<string>`lower(${user.email})`,
      userId: user.id,
      lastInvitedAt: memberInvitationState.lastInvitedAt,
      firstSignedInAt: memberInvitationState.firstSignedInAt,
    })
    .from(user)
    .leftJoin(
      memberInvitationState,
      and(
        eq(memberInvitationState.userId, user.id),
        eq(memberInvitationState.organizationId, organizationId)
      )
    )
    .where(inArray(sql`lower(${user.email})`, keys))
}
