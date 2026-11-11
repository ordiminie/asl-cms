import {eq} from 'drizzle-orm'

import {campaignRecipient, memberUnsubscribe} from '@/db/models/campaign-model'
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
