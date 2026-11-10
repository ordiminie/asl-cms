import {and, asc, count, desc, eq, inArray, isNull, sql} from 'drizzle-orm'

import {
  AddCampaignModel,
  campaign,
  CampaignModel,
  campaignRecipient,
  CampaignStatusModel,
  memberUnsubscribe,
} from '@/db/models/campaign-model'
import {memberProfile} from '@/db/models/member-profile-model'
import {parcel, parcelOwnership} from '@/db/models/parcel-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Campagnes email (s25, ADR 051). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit. Les
 * ecritures s'executent dans la transaction du scope de tenant.
 */

/** Une fiche telle que le calcul de cible la lit. */
export type CampaignTargetRowModel = {
  memberProfileId: string
  name: string
  email: string | null
  unsubscribed: boolean
}

export type CampaignPageRows = {rows: CampaignModel[]; total: number}

/** Un destinataire encore a servir, avec ce que le rendu remplace. */
export type PendingRecipientRowModel = {
  recipientId: string
  memberProfileId: string
  name: string
  email: string | null
  unsubscribeToken: string
  parcelNumbers: string[]
}

export type CampaignRecipientInput = {
  memberProfileId: string
  unsubscribeToken: string
}

export type CreatedCampaign = {campaign: CampaignModel; created: boolean}

export const getCampaignTargetRowsDao = async (
  organizationId: string
): Promise<CampaignTargetRowModel[]> =>
  getDb()
    .select({
      memberProfileId: memberProfile.id,
      name: memberProfile.name,
      email: memberProfile.email,
      unsubscribed: sql<boolean>`${memberUnsubscribe.id} is not null`,
    })
    .from(memberProfile)
    .leftJoin(
      memberUnsubscribe,
      eq(memberUnsubscribe.memberProfileId, memberProfile.id)
    )
    .where(eq(memberProfile.organizationId, organizationId))
    .orderBy(asc(memberProfile.name), asc(memberProfile.id))

/** Les numeros des parcelles **actuelles** (periodes ouvertes) de chaque fiche. */
export const getCurrentParcelNumbersForMembersDao = async (
  memberProfileIds: string[]
): Promise<Record<string, string[]>> => {
  if (memberProfileIds.length === 0) return {}

  const rows = await getDb()
    .select({
      memberProfileId: parcelOwnership.memberProfileId,
      number: parcel.number,
    })
    .from(parcelOwnership)
    .innerJoin(parcel, eq(parcel.id, parcelOwnership.parcelId))
    .where(
      and(
        inArray(parcelOwnership.memberProfileId, memberProfileIds),
        isNull(parcelOwnership.endsOn)
      )
    )
    .orderBy(asc(parcel.number))

  const numbers: Record<string, string[]> = {}
  for (const row of rows) {
    numbers[row.memberProfileId] = [
      ...(numbers[row.memberProfileId] ?? []),
      row.number,
    ]
  }
  return numbers
}

/**
 * Cree la campagne et **toutes** ses lignes de destinataire dans la
 * transaction du scope (ADR 051). Une soumission deja vue (double clic,
 * rejeu) ne cree rien : la campagne existante est relue, sans seconde ligne.
 */
export const createCampaignWithRecipientsTxnDao = async (
  input: Omit<
    AddCampaignModel,
    'id' | 'sentCount' | 'createdAt' | 'updatedAt' | 'finishedAt'
  >,
  recipients: CampaignRecipientInput[]
): Promise<CreatedCampaign | undefined> => {
  const [created] = await getDb()
    .insert(campaign)
    .values(input)
    .onConflictDoNothing({
      target: [campaign.organizationId, campaign.submissionId],
    })
    .returning()

  if (!created) {
    const [existing] = await getDb()
      .select()
      .from(campaign)
      .where(
        and(
          eq(campaign.organizationId, input.organizationId),
          eq(campaign.submissionId, input.submissionId)
        )
      )
    return existing ? {campaign: existing, created: false} : undefined
  }

  if (recipients.length > 0) {
    await getDb()
      .insert(campaignRecipient)
      .values(
        recipients.map((recipient) => ({
          organizationId: input.organizationId,
          campaignId: created.id,
          memberProfileId: recipient.memberProfileId,
          unsubscribeToken: recipient.unsubscribeToken,
        }))
      )
  }
  return {campaign: created, created: true}
}

export const getCampaignByIdDao = async (
  organizationId: string,
  campaignId: string
): Promise<CampaignModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(campaign)
    .where(
      and(
        eq(campaign.id, campaignId),
        eq(campaign.organizationId, organizationId)
      )
    )
  return row
}

/**
 * Une page de l'archive, la plus recente d'abord ; l'identifiant departage,
 * pour que la pagination ne saute ni ne repete une ligne.
 */
export const getCampaignsPageDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<CampaignPageRows> => {
  const where = eq(campaign.organizationId, input.organizationId)
  const rows = await getDb()
    .select()
    .from(campaign)
    .where(where)
    .orderBy(desc(campaign.createdAt), desc(campaign.id))
    .limit(input.limit)
    .offset(input.offset)
  const [{total}] = await getDb()
    .select({total: count()})
    .from(campaign)
    .where(where)
  return {rows, total}
}

/**
 * Les destinataires encore `pending`, dans un ordre stable. Une fiche
 * supprimee depuis (`member_profile_id` a NULL) n'est plus servie.
 */
export const getPendingRecipientsDao = async (
  campaignId: string
): Promise<PendingRecipientRowModel[]> => {
  const rows = await getDb()
    .select({
      recipientId: campaignRecipient.id,
      memberProfileId: memberProfile.id,
      name: memberProfile.name,
      email: memberProfile.email,
      unsubscribeToken: campaignRecipient.unsubscribeToken,
    })
    .from(campaignRecipient)
    .innerJoin(
      memberProfile,
      eq(memberProfile.id, campaignRecipient.memberProfileId)
    )
    .where(
      and(
        eq(campaignRecipient.campaignId, campaignId),
        eq(campaignRecipient.status, 'pending')
      )
    )
    .orderBy(asc(campaignRecipient.id))

  const numbers = await getCurrentParcelNumbersForMembersDao(
    rows.map((row) => row.memberProfileId)
  )
  return rows.map((row) => ({
    ...row,
    parcelNumbers: numbers[row.memberProfileId] ?? [],
  }))
}

/**
 * Marque un envoi parti **et** avance la campagne dans la meme instruction :
 * le statut de la ligne et `sent_count` ne peuvent pas diverger.
 */
export const markRecipientSentTxnDao = async (
  recipientId: string
): Promise<{campaignId: string; sentCount: number} | undefined> => {
  const sentRecipient = getDb()
    .$with('sent_recipient')
    .as(
      getDb()
        .update(campaignRecipient)
        .set({status: 'sent', sentAt: sql`now()`})
        .where(
          and(
            eq(campaignRecipient.id, recipientId),
            eq(campaignRecipient.status, 'pending')
          )
        )
        .returning({campaignId: campaignRecipient.campaignId})
    )

  const [row] = await getDb()
    .with(sentRecipient)
    .update(campaign)
    .set({
      sentCount: sql`${campaign.sentCount} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      inArray(
        campaign.id,
        getDb().select({id: sentRecipient.campaignId}).from(sentRecipient)
      )
    )
    .returning({campaignId: campaign.id, sentCount: campaign.sentCount})
  return row
}

export const markRecipientFailedTxnDao = async (
  recipientId: string
): Promise<{id: string} | undefined> => {
  const [row] = await getDb()
    .update(campaignRecipient)
    .set({status: 'failed'})
    .where(
      and(
        eq(campaignRecipient.id, recipientId),
        eq(campaignRecipient.status, 'pending')
      )
    )
    .returning({id: campaignRecipient.id})
  return row
}

/** Clot une campagne encore `sending` : `sent` ou `interrupted`. */
export const finishCampaignTxnDao = async (
  campaignId: string,
  status: Exclude<CampaignStatusModel, 'sending'>
): Promise<{id: string} | undefined> => {
  const [row] = await getDb()
    .update(campaign)
    .set({status, finishedAt: sql`now()`, updatedAt: sql`now()`})
    .where(and(eq(campaign.id, campaignId), eq(campaign.status, 'sending')))
    .returning({id: campaign.id})
  return row
}
