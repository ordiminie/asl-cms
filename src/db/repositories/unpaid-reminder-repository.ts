import {and, asc, eq, inArray, sql} from 'drizzle-orm'

import {
  campaign,
  campaignLetterProfile,
  campaignRecipient,
  campaignRecipientProfile,
  CampaignStatusModel,
} from '@/db/models/campaign-model'
import {unpaidReminder} from '@/db/models/unpaid-reminder-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Rangs des relances d'impayes (s29, ADR 070). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

/** Un rang cree, avec l'etat de sa campagne et son dernier envoi reel. */
export type UnpaidReminderRowModel = {
  dueOn: string
  rank: number
  campaignId: string
  campaignStatus: CampaignStatusModel
  /** Dernier jour de Paris ou un email du rang est parti, ou rien. */
  lastSentOn: string | null
}

/**
 * Ecrit le rang d'une echeance (ADR 070 §6). Appelee **dans la transaction**
 * de la creation de sa campagne : l'unicite `(organization_id, due_on, rank)`
 * refuse un second rang, et toute la creation avec lui.
 */
export const insertUnpaidReminderTxnDao = async (input: {
  organizationId: string
  dueOn: string
  rank: number
  campaignId: string
}): Promise<void> => {
  await getDb().insert(unpaidReminder).values(input)
}

/**
 * Les rangs de l'association, par echeance puis rang, avec l'etat de leur
 * campagne et le dernier jour (Paris) ou un de leurs emails est reellement
 * parti (ADR 070 §5).
 */
export const listUnpaidRemindersDao = async (
  organizationId: string
): Promise<UnpaidReminderRowModel[]> =>
  getDb()
    .select({
      dueOn: unpaidReminder.dueOn,
      rank: unpaidReminder.rank,
      campaignId: unpaidReminder.campaignId,
      campaignStatus: campaign.status,
      lastSentOn: sql<
        string | null
      >`(select to_char(max(${campaignRecipient.sentAt} at time zone 'Europe/Paris'), 'YYYY-MM-DD') from ${campaignRecipient} where ${campaignRecipient.campaignId} = ${unpaidReminder.campaignId} and ${campaignRecipient.status} = 'sent')`,
    })
    .from(unpaidReminder)
    .innerJoin(campaign, eq(campaign.id, unpaidReminder.campaignId))
    .where(eq(unpaidReminder.organizationId, organizationId))
    .orderBy(asc(unpaidReminder.dueOn), asc(unpaidReminder.rank))

/** Une fiche qui a recu un rang par email, a l'instant de reception. */
export type ReminderEmailRowModel = {
  campaignId: string
  memberProfileId: string
  sentAt: Date
}

/** Une fiche adressee par courrier dans un rang (s28, ADR 065). */
export type ReminderLetterRowModel = {
  campaignId: string
  memberProfileId: string
}

/**
 * Par fiche, les rangs recus par email (ligne `sent` dont l'adresse
 * representait la fiche, ADR 061) et les rangs adresses par courrier (fiches
 * figees sans adresse). Ni adresse ni jeton.
 */
export const getReminderRecipientsByProfileDao = async (
  organizationId: string,
  campaignIds: string[]
): Promise<{
  emails: ReminderEmailRowModel[]
  letters: ReminderLetterRowModel[]
}> => {
  if (campaignIds.length === 0) return {emails: [], letters: []}

  const emailRows = await getDb()
    .select({
      campaignId: campaignRecipient.campaignId,
      memberProfileId: campaignRecipientProfile.memberProfileId,
      sentAt: campaignRecipient.sentAt,
    })
    .from(campaignRecipientProfile)
    .innerJoin(
      campaignRecipient,
      eq(campaignRecipient.id, campaignRecipientProfile.campaignRecipientId)
    )
    .where(
      and(
        eq(campaignRecipientProfile.organizationId, organizationId),
        inArray(campaignRecipient.campaignId, campaignIds),
        eq(campaignRecipient.status, 'sent')
      )
    )
  const letters = await getDb()
    .select({
      campaignId: campaignLetterProfile.campaignId,
      memberProfileId: campaignLetterProfile.memberProfileId,
    })
    .from(campaignLetterProfile)
    .where(
      and(
        eq(campaignLetterProfile.organizationId, organizationId),
        inArray(campaignLetterProfile.campaignId, campaignIds)
      )
    )
  return {
    emails: emailRows.flatMap((row) =>
      row.sentAt
        ? [
            {
              campaignId: row.campaignId,
              memberProfileId: row.memberProfileId,
              sentAt: new Date(row.sentAt),
            },
          ]
        : []
    ),
    letters,
  }
}
