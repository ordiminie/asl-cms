import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from 'drizzle-orm'

import {
  AddCampaignModel,
  campaign,
  CampaignModel,
  campaignPart,
  CampaignPartStatusModel,
  campaignRecipient,
  CampaignRecipientStatusModel,
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

/**
 * Un destinataire encore a servir, avec ce que le rendu remplace. Une fiche
 * supprimee depuis la creation laisse la ligne, sans nom ni adresse.
 */
export type PendingRecipientRowModel = {
  recipientId: string
  memberProfileId: string | null
  name: string | null
  email: string | null
  unsubscribeToken: string
  /** La fiche a refuse les campagnes depuis la creation (s26). */
  unsubscribed: boolean
  parcelNumbers: string[]
}

/** Une part telle que sa livraison la lit. */
export type CampaignPartRowModel = {
  id: string
  campaignId: string
  number: number
  scheduledFor: string
  recipientCount: number
  status: CampaignPartStatusModel
}

export type CampaignRecipientInput = {
  memberProfileId: string
  unsubscribeToken: string
}

/** Une part du plan, telle que la creation l'ecrit. */
export type CampaignPartInput = {
  number: number
  scheduledFor: string
  recipientCount: number
}

export type CreatedCampaignPart = {
  id: string
  number: number
  scheduledFor: string
}

export type CreatedCampaign = {
  campaign: CampaignModel
  created: boolean
  /** Les parts creees ; aucune pour une soumission deja connue. */
  parts: CreatedCampaignPart[]
}

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
 * Les destinataires, dans leur ordre, rattaches aux parts du plan : la part 1
 * prend les premiers, et ainsi de suite. Un plan qui ne couvre pas exactement
 * les destinataires est une erreur de programmation.
 */
const assignRecipientsToParts = (
  parts: readonly (CampaignPartInput & {id: string})[],
  recipients: readonly CampaignRecipientInput[]
): (CampaignRecipientInput & {partId: string})[] => {
  const planned = parts.reduce((total, part) => total + part.recipientCount, 0)
  if (planned !== recipients.length) {
    throw new Error('Plan d’envoi incoherent avec les destinataires')
  }
  let next = 0
  return parts.flatMap((part) =>
    recipients
      .slice(next, (next += part.recipientCount))
      .map((recipient) => ({...recipient, partId: part.id}))
  )
}

/**
 * Cree la campagne, ses parts et **toutes** ses lignes de destinataire dans la
 * transaction du scope (ADR 051, ADR 052). Une soumission deja vue (double
 * clic, rejeu) ne cree rien : la campagne existante est relue, sans part ni
 * ligne de plus.
 */
export const createCampaignWithRecipientsTxnDao = async (
  input: Omit<
    AddCampaignModel,
    'id' | 'sentCount' | 'createdAt' | 'updatedAt' | 'finishedAt'
  >,
  plan: readonly CampaignPartInput[],
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
    return existing
      ? {campaign: existing, created: false, parts: []}
      : undefined
  }

  if (plan.length === 0) return {campaign: created, created: true, parts: []}

  const parts = await getDb()
    .insert(campaignPart)
    .values(
      plan.map((part) => ({
        organizationId: input.organizationId,
        campaignId: created.id,
        number: part.number,
        scheduledFor: part.scheduledFor,
        recipientCount: part.recipientCount,
      }))
    )
    .returning({
      id: campaignPart.id,
      number: campaignPart.number,
      scheduledFor: campaignPart.scheduledFor,
    })

  const assigned = assignRecipientsToParts(
    plan.map((part) => ({
      ...part,
      id: parts.find((row) => row.number === part.number)?.id ?? '',
    })),
    recipients
  )
  await getDb()
    .insert(campaignRecipient)
    .values(
      assigned.map((recipient) => ({
        organizationId: input.organizationId,
        campaignId: created.id,
        memberProfileId: recipient.memberProfileId,
        partId: recipient.partId,
        unsubscribeToken: recipient.unsubscribeToken,
      }))
    )
  return {campaign: created, created: true, parts}
}

/**
 * Verrou consultatif du plan d'envoi de l'association, tenu jusqu'a la fin de
 * la transaction du scope : deux creations simultanees sont serialisees, la
 * seconde lit les parts de la premiere.
 */
export const lockCampaignScheduleTxnDao = async (
  organizationId: string
): Promise<void> => {
  const lockKey = `campaign_schedule:${organizationId}`
  await getDb().execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
  )
}

/**
 * Destinataires deja programmes par jour, toutes campagnes de l'association,
 * a partir de `fromDay` : les parts non echouees.
 */
export const getAllottedRecipientsByDayDao = async (
  organizationId: string,
  fromDay: string
): Promise<Record<string, number>> => {
  const rows = await getDb()
    .select({
      day: campaignPart.scheduledFor,
      total: sql<string>`sum(${campaignPart.recipientCount})`,
    })
    .from(campaignPart)
    .where(
      and(
        eq(campaignPart.organizationId, organizationId),
        gte(campaignPart.scheduledFor, fromDay),
        ne(campaignPart.status, 'failed')
      )
    )
    .groupBy(campaignPart.scheduledFor)
  return Object.fromEntries(rows.map((row) => [row.day, Number(row.total)]))
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
 * Les destinataires encore `pending` d'une part, dans l'ordre stable de leur
 * identifiant, avec le refus eventuel de leur fiche. Une fiche supprimee
 * depuis (`member_profile_id` a NULL) laisse la ligne, sans adresse : la
 * livraison la traite au lieu de la perdre.
 */
export const getPendingPartRecipientsDao = async (
  partId: string
): Promise<PendingRecipientRowModel[]> => {
  const rows = await getDb()
    .select({
      recipientId: campaignRecipient.id,
      memberProfileId: memberProfile.id,
      name: memberProfile.name,
      email: memberProfile.email,
      unsubscribeToken: campaignRecipient.unsubscribeToken,
      unsubscribed: sql<boolean>`${memberUnsubscribe.id} is not null`,
    })
    .from(campaignRecipient)
    .leftJoin(
      memberProfile,
      eq(memberProfile.id, campaignRecipient.memberProfileId)
    )
    .leftJoin(
      memberUnsubscribe,
      eq(memberUnsubscribe.memberProfileId, campaignRecipient.memberProfileId)
    )
    .where(
      and(
        eq(campaignRecipient.partId, partId),
        eq(campaignRecipient.status, 'pending')
      )
    )
    .orderBy(asc(campaignRecipient.id))

  const numbers = await getCurrentParcelNumbersForMembersDao(
    rows.flatMap((row) => (row.memberProfileId ? [row.memberProfileId] : []))
  )
  return rows.map((row) => ({
    ...row,
    parcelNumbers: row.memberProfileId
      ? (numbers[row.memberProfileId] ?? [])
      : [],
  }))
}

export const getCampaignPartDao = async (
  partId: string
): Promise<CampaignPartRowModel | undefined> => {
  const [row] = await getDb()
    .select({
      id: campaignPart.id,
      campaignId: campaignPart.campaignId,
      number: campaignPart.number,
      scheduledFor: campaignPart.scheduledFor,
      recipientCount: campaignPart.recipientCount,
      status: campaignPart.status,
    })
    .from(campaignPart)
    .where(eq(campaignPart.id, partId))
  return row
}

/**
 * Pose « en cours d'envoi » **avant** l'envoi (ADR 052) : une seule ligne
 * `pending` passe `sending`, horodatee. Deux passages paralleles sur la meme
 * ligne : un seul obtient `true`.
 */
export const claimRecipientForSendTxnDao = async (
  recipientId: string
): Promise<boolean> => {
  const rows = await getDb()
    .update(campaignRecipient)
    .set({status: 'sending', claimedAt: sql`now()`})
    .where(
      and(
        eq(campaignRecipient.id, recipientId),
        eq(campaignRecipient.status, 'pending')
      )
    )
    .returning({id: campaignRecipient.id})
  return rows.length > 0
}

/** Refus certain du fournisseur : l'email n'est pas parti, la ligne attend. */
export const releaseRecipientClaimTxnDao = async (
  recipientId: string
): Promise<void> => {
  await getDb()
    .update(campaignRecipient)
    .set({status: 'pending', claimedAt: null})
    .where(
      and(
        eq(campaignRecipient.id, recipientId),
        eq(campaignRecipient.status, 'sending')
      )
    )
}

/** Issue inconnue : la ligne est a verifier, jamais renvoyee. */
export const markRecipientToVerifyTxnDao = async (
  recipientId: string
): Promise<void> => {
  await getDb()
    .update(campaignRecipient)
    .set({status: 'to_verify'})
    .where(
      and(
        eq(campaignRecipient.id, recipientId),
        eq(campaignRecipient.status, 'sending')
      )
    )
}

/** La fiche a refuse les campagnes entre deux parts : rien n'est envoye. */
export const markRecipientUnsubscribedTxnDao = async (
  recipientId: string
): Promise<void> => {
  await getDb()
    .update(campaignRecipient)
    .set({status: 'unsubscribed'})
    .where(
      and(
        eq(campaignRecipient.id, recipientId),
        eq(campaignRecipient.status, 'pending')
      )
    )
}

/**
 * Les lignes d'une part laissees `sending` par un arret (redemarrage entre
 * l'envoi et son enregistrement) passent `to_verify`. Rend leur nombre.
 */
export const markStaleSendingRecipientsToVerifyTxnDao = async (
  partId: string,
  staleBefore: Date
): Promise<number> => {
  const rows = await getDb()
    .update(campaignRecipient)
    .set({status: 'to_verify'})
    .where(
      and(
        eq(campaignRecipient.partId, partId),
        eq(campaignRecipient.status, 'sending'),
        lt(campaignRecipient.claimedAt, staleBefore)
      )
    )
    .returning({id: campaignRecipient.id})
  return rows.length
}

/**
 * Toutes les lignes `sending` d'une part passent `to_verify`, quel que soit
 * leur age : a la reprise d'une tache dont le detenteur est mort, ou a la
 * cloture d'une part. Rend leur nombre.
 */
export const markSendingRecipientsToVerifyTxnDao = async (
  partId: string
): Promise<number> => {
  const rows = await getDb()
    .update(campaignRecipient)
    .set({status: 'to_verify'})
    .where(
      and(
        eq(campaignRecipient.partId, partId),
        eq(campaignRecipient.status, 'sending')
      )
    )
    .returning({id: campaignRecipient.id})
  return rows.length
}

/** Tentatives epuisees : les lignes encore en attente ne partiront pas. */
export const failUnreceivedRecipientsTxnDao = async (
  campaignId: string
): Promise<void> => {
  await getDb()
    .update(campaignRecipient)
    .set({status: 'failed'})
    .where(
      and(
        eq(campaignRecipient.campaignId, campaignId),
        eq(campaignRecipient.status, 'pending')
      )
    )
}

const UNFINISHED_PART_STATUSES: CampaignPartStatusModel[] = [
  'scheduled',
  'sending',
]

export const startCampaignPartTxnDao = async (
  partId: string
): Promise<void> => {
  await getDb()
    .update(campaignPart)
    .set({status: 'sending'})
    .where(
      and(
        eq(campaignPart.id, partId),
        inArray(campaignPart.status, UNFINISHED_PART_STATUSES)
      )
    )
}

export const finishCampaignPartTxnDao = async (
  partId: string,
  status: Extract<CampaignPartStatusModel, 'sent' | 'failed'>
): Promise<void> => {
  await getDb()
    .update(campaignPart)
    .set({status, finishedAt: sql`now()`})
    .where(eq(campaignPart.id, partId))
}

/** La part `fromNumber` et les suivantes, encore non closes, passent en echec. */
export const failCampaignPartsFromTxnDao = async (
  campaignId: string,
  fromNumber: number
): Promise<void> => {
  await getDb()
    .update(campaignPart)
    .set({status: 'failed', finishedAt: sql`now()`})
    .where(
      and(
        eq(campaignPart.campaignId, campaignId),
        gte(campaignPart.number, fromNumber),
        inArray(campaignPart.status, UNFINISHED_PART_STATUSES)
      )
    )
}

/** Les parts de la campagne ni envoyees ni echouees. */
export const countUnfinishedCampaignPartsDao = async (
  campaignId: string
): Promise<number> => {
  const [{total}] = await getDb()
    .select({total: count()})
    .from(campaignPart)
    .where(
      and(
        eq(campaignPart.campaignId, campaignId),
        inArray(campaignPart.status, UNFINISHED_PART_STATUSES)
      )
    )
  return total
}

/**
 * Marque un envoi parti **et** avance la campagne dans la meme instruction :
 * le statut de la ligne et `sent_count` ne peuvent pas diverger. Seule une
 * ligne `sending` (prise avant l'envoi) passe `sent`.
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
            eq(campaignRecipient.status, 'sending')
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

/** Les parts des campagnes donnees, dans l'ordre de leur numero. */
export const getCampaignPartsDao = async (
  campaignIds: string[]
): Promise<CampaignPartRowModel[]> => {
  if (campaignIds.length === 0) return []

  return getDb()
    .select({
      id: campaignPart.id,
      campaignId: campaignPart.campaignId,
      number: campaignPart.number,
      scheduledFor: campaignPart.scheduledFor,
      recipientCount: campaignPart.recipientCount,
      status: campaignPart.status,
    })
    .from(campaignPart)
    .where(inArray(campaignPart.campaignId, campaignIds))
    .orderBy(asc(campaignPart.campaignId), asc(campaignPart.number))
}

export type RecipientStatusCountRowModel = {
  campaignId: string
  partId: string
  status: CampaignRecipientStatusModel
  total: number
}

/** Les lignes de destinataire comptees par campagne, part et statut. */
export const getRecipientStatusCountsDao = async (
  campaignIds: string[]
): Promise<RecipientStatusCountRowModel[]> => {
  if (campaignIds.length === 0) return []

  const rows = await getDb()
    .select({
      campaignId: campaignRecipient.campaignId,
      partId: campaignRecipient.partId,
      status: campaignRecipient.status,
      total: count(),
    })
    .from(campaignRecipient)
    .where(inArray(campaignRecipient.campaignId, campaignIds))
    .groupBy(
      campaignRecipient.campaignId,
      campaignRecipient.partId,
      campaignRecipient.status
    )
  return rows.map((row) => ({...row, total: Number(row.total)}))
}

/** Un destinataire tel que la liste du bureau le montre : aucun jeton. */
export type CampaignRecipientRowModel = {
  id: string
  /** `null` : la fiche a ete supprimee depuis l'envoi. */
  name: string | null
  status: CampaignRecipientStatusModel
  sentAt: Date | null
  /** Le jour de la part du destinataire. */
  scheduledFor: string
  parcelNumbers: string[]
}

export type CampaignRecipientsPageInput = {
  organizationId: string
  campaignId: string
  /** `null` : tous les statuts. */
  statuses: CampaignRecipientStatusModel[] | null
  limit: number
  offset: number
}

/**
 * Une page des destinataires d'une campagne, bornee a la campagne **et** a
 * l'association, triee par nom puis identifiant. Une fiche supprimee depuis
 * laisse sa ligne, sans nom (`leftJoin`).
 */
export const getCampaignRecipientsPageDao = async (
  input: CampaignRecipientsPageInput
): Promise<{rows: CampaignRecipientRowModel[]; total: number}> => {
  const where = and(
    eq(campaignRecipient.organizationId, input.organizationId),
    eq(campaignRecipient.campaignId, input.campaignId),
    input.statuses
      ? inArray(campaignRecipient.status, input.statuses)
      : undefined
  )
  const rows = await getDb()
    .select({
      id: campaignRecipient.id,
      memberProfileId: memberProfile.id,
      name: memberProfile.name,
      status: campaignRecipient.status,
      sentAt: campaignRecipient.sentAt,
      scheduledFor: campaignPart.scheduledFor,
    })
    .from(campaignRecipient)
    .leftJoin(
      memberProfile,
      eq(memberProfile.id, campaignRecipient.memberProfileId)
    )
    .innerJoin(campaignPart, eq(campaignPart.id, campaignRecipient.partId))
    .where(where)
    .orderBy(
      sql`${memberProfile.name} asc nulls last`,
      asc(campaignRecipient.id)
    )
    .limit(input.limit)
    .offset(input.offset)
  const [{total}] = await getDb()
    .select({total: count()})
    .from(campaignRecipient)
    .where(where)

  const numbers = await getCurrentParcelNumbersForMembersDao(
    rows.flatMap((row) => (row.memberProfileId ? [row.memberProfileId] : []))
  )
  return {
    rows: rows.map(({memberProfileId, ...row}) => ({
      ...row,
      parcelNumbers: memberProfileId ? (numbers[memberProfileId] ?? []) : [],
    })),
    total,
  }
}
