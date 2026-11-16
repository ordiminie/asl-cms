import {and, eq, isNull, sql} from 'drizzle-orm'

import {campaignRecipient} from '@/db/models/campaign-model'
import {memberProfileEmail} from '@/db/models/member-profile-email-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Desinscription des campagnes (s25, ADR 051). Depuis s54 (ADR 057), le
 * refus est porte par l'adresse de fiche (`member_profile_email
 * .unsubscribed_at`) ; `member_unsubscribe` est retiree. Sous RLS forcee : un
 * jeton est resolu **dans le tenant du domaine appele** ; celui d'une autre
 * association ne rend rien.
 */

/** Une ligne de destinataire retrouvee par son jeton, avec le refus eventuel. */
export type RecipientByTokenRowModel = {
  recipientId: string
  organizationId: string
  campaignId: string
  memberProfileId: string | null
  /** L'adresse visee par la ligne (ADR 057). */
  email: string
  /** Le premier refus d'une adresse de l'association egale a celle-ci. */
  unsubscribedAt: Date | null
}

const dateOf = (value: string | Date | null): Date | null =>
  value === null ? null : new Date(value)

export const getRecipientByTokenDao = async (
  token: string
): Promise<RecipientByTokenRowModel | undefined> => {
  const [row] = await getDb()
    .select({
      recipientId: campaignRecipient.id,
      organizationId: campaignRecipient.organizationId,
      campaignId: campaignRecipient.campaignId,
      memberProfileId: campaignRecipient.memberProfileId,
      email: campaignRecipient.email,
      unsubscribedAt: sql<
        string | null
      >`(select min(mpe_refusal."unsubscribed_at") from "member_profile_email" mpe_refusal where mpe_refusal."organization_id" = "campaign_recipient"."organization_id" and lower(trim(mpe_refusal."email")) = lower(trim("campaign_recipient"."email")))`,
    })
    .from(campaignRecipient)
    .where(eq(campaignRecipient.unsubscribeToken, token))
    .limit(1)
  return row ? {...row, unsubscribedAt: dateOf(row.unsubscribedAt)} : undefined
}

/**
 * Date le refus de **toutes** les adresses de l'association egales, sans
 * casse, a celle-ci (ADR 057) ; un refus deja pose n'est pas reecrit. Rend le
 * nombre d'adresses datees.
 */
export const unsubscribeEmailIfAbsentTxnDao = async (
  organizationId: string,
  email: string
): Promise<number> => {
  const rows = await getDb()
    .update(memberProfileEmail)
    .set({unsubscribedAt: sql`now()`})
    .where(
      and(
        eq(memberProfileEmail.organizationId, organizationId),
        sql`lower(trim(${memberProfileEmail.email})) = lower(trim(${email}))`,
        isNull(memberProfileEmail.unsubscribedAt)
      )
    )
    .returning({id: memberProfileEmail.id})
  return rows.length
}

/**
 * Le refus d'une fiche, pour la mention du bureau : seulement quand **toutes**
 * ses adresses actives ont refuse les campagnes (aucune ne les recoit plus),
 * date du plus recent. Une fiche dont une adresse recoit encore n'a pas de
 * refus.
 */
export const getUnsubscribeByMemberDao = async (
  memberProfileId: string
): Promise<{createdAt: Date} | undefined> => {
  const [row] = await getDb()
    .select({
      active: sql<number>`count(*)::int`,
      refused: sql<number>`count(${memberProfileEmail.unsubscribedAt})::int`,
      latest: sql<string | null>`max(${memberProfileEmail.unsubscribedAt})`,
    })
    .from(memberProfileEmail)
    .where(
      and(
        eq(memberProfileEmail.memberProfileId, memberProfileId),
        eq(memberProfileEmail.status, 'active')
      )
    )
  if (!row || row.active === 0 || row.refused < row.active) return undefined
  const createdAt = dateOf(row.latest)
  return createdAt ? {createdAt} : undefined
}
