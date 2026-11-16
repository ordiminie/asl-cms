import {and, eq, sql} from 'drizzle-orm'
import {alias} from 'drizzle-orm/pg-core'

import {campaignRecipient, memberUnsubscribe} from '@/db/models/campaign-model'
import {memberProfile} from '@/db/models/member-profile-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Desinscription des campagnes (s25, ADR 051). Sous RLS forcee : un jeton est
 * resolu **dans le tenant du domaine appele** ; celui d'une autre association
 * ne rend rien.
 */

/** Une ligne de destinataire retrouvee par son jeton, avec le refus eventuel. */
export type RecipientByTokenRowModel = {
  recipientId: string
  organizationId: string
  campaignId: string
  memberProfileId: string | null
  unsubscribedAt: Date | null
}

export const getRecipientByTokenDao = async (
  token: string
): Promise<RecipientByTokenRowModel | undefined> => {
  const [row] = await getDb()
    .select({
      recipientId: campaignRecipient.id,
      organizationId: campaignRecipient.organizationId,
      campaignId: campaignRecipient.campaignId,
      memberProfileId: campaignRecipient.memberProfileId,
      unsubscribedAt: memberUnsubscribe.createdAt,
    })
    .from(campaignRecipient)
    .leftJoin(
      memberUnsubscribe,
      eq(memberUnsubscribe.memberProfileId, campaignRecipient.memberProfileId)
    )
    .where(eq(campaignRecipient.unsubscribeToken, token))
    .limit(1)
  return row
}

export const getUnsubscribeByMemberDao = async (
  memberProfileId: string
): Promise<{createdAt: Date} | undefined> => {
  const [row] = await getDb()
    .select({createdAt: memberUnsubscribe.createdAt})
    .from(memberUnsubscribe)
    .where(eq(memberUnsubscribe.memberProfileId, memberProfileId))
  return row
}

/** Enregistre le refus d'une fiche ; un refus deja present n'est pas reecrit. */
export const createUnsubscribeIfAbsentTxnDao = async (input: {
  organizationId: string
  memberProfileId: string
  campaignId: string | null
}): Promise<{memberProfileId: string} | undefined> => {
  const [row] = await getDb()
    .insert(memberUnsubscribe)
    .values(input)
    .onConflictDoNothing({
      target: [
        memberUnsubscribe.organizationId,
        memberUnsubscribe.memberProfileId,
      ],
    })
    .returning({memberProfileId: memberUnsubscribe.memberProfileId})
  return row
}

/**
 * Les fiches de l'association qui portent, sans casse, la meme adresse que
 * cette fiche, elle comprise (s53, ADR 055) : la desinscription couvre
 * l'adresse. Une fiche sans adresse ne rend qu'elle-meme.
 */
export const getMemberProfileIdsSharingEmailDao = async (
  organizationId: string,
  memberProfileId: string
): Promise<string[]> => {
  const source = alias(memberProfile, 'source_profile')
  const rows = await getDb()
    .select({id: memberProfile.id})
    .from(memberProfile)
    .innerJoin(
      source,
      sql`lower(trim(${source.email})) = lower(trim(${memberProfile.email}))`
    )
    .where(
      and(
        eq(source.id, memberProfileId),
        eq(memberProfile.organizationId, organizationId)
      )
    )
  const ids = rows.map((row) => row.id)
  return ids.includes(memberProfileId) ? ids : [memberProfileId, ...ids]
}
