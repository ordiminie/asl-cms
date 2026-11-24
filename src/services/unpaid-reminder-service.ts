import 'server-only'

import {z} from 'zod'

import {
  getCampaignByIdDao,
  getCampaignPartsDao,
  getCampaignTargetRowsDao,
  getRecipientStatusCountsDao,
} from '@/db/repositories/campaign-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {
  getReminderRecipientsByProfileDao,
  listUnpaidRemindersDao,
  type UnpaidReminderRowModel,
} from '@/db/repositories/unpaid-reminder-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {resolveMemberBillingProvider} from './billing/resolve-member-billing-provider'
import {
  type CampaignTargetReading,
  createCampaignInTenant,
} from './campaign-service'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {computeCampaignTarget, toCampaignDto} from './rules/campaign-rules'
import {
  addDays,
  partRunAfter,
  retryDelayMs,
} from './rules/campaign-schedule-rules'
import {
  getInvoiceStatusClassification,
  isUnpaidInvoice,
} from './rules/member-invoice-rules'
import {
  dueReminderRankOf,
  plannedReminderDayOf,
  type ReminderRankState,
  reminderSubmissionIdOf,
  unpaidDueDatesOf,
  unpaidProfileIdsForDueOn,
} from './rules/unpaid-reminder-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS,
  getCampaignDailySendCap,
  getCampaignNature,
  getUnpaidReminderSettings,
  type ResolvedAssociationSettings,
  type UnpaidReminderSettings,
} from './types/domain/association-settings-types'
import {UNPAID_REMINDER_SEND_KIND} from './types/domain/campaign-types'
import type {MemberInvoice} from './types/domain/member-invoice-types'
import {
  BILLING_UNPAID_REMINDERS_JOB_KIND,
  type ScheduledJob,
  type ScheduledJobHandlers,
  type ScheduledJobOutcome,
} from './types/domain/scheduled-job-types'
import {
  UNPAID_REMINDERS_PAGE_SIZE,
  type UnpaidReminderMemberDTO,
  type UnpaidReminderRankDTO,
  type UnpaidReminderReceivedDTO,
  type UnpaidReminderScheduleDTO,
  type UnpaidRemindersOverviewDTO,
  type UnpaidRemindersOverviewInput,
} from './types/domain/unpaid-reminder-types'
import {calendarDayOf} from './types/domain/water-analysis-types'

/**
 * Relances automatiques des impayes (s29, ADR 070). Une relance est une
 * campagne creee **sans session** par la tache quotidienne
 * `billing.unpaid_reminders`, pour un couple (echeance, rang), par le coeur
 * partage avec l'envoi du bureau. Factures et destinataires sont des donnees
 * personnelles : jamais dans un journal (intercepteur sans details).
 */

const REMINDERS_DENIED =
  "Seul le bureau de l'association peut gerer les relances des impayes"

const organizationIdSchema = z.string().uuid()
const overviewInputSchema = z.object({
  organizationId: z.string().uuid(),
  page: z.number().int().min(1),
})

const parseOrThrow = <S extends z.ZodType>(
  schema: S,
  input: unknown
): z.output<S> => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

const requireCampaignManager = async (organizationId: string) => {
  const authUser = await getAuthUser()
  if (
    !authUser ||
    !canPerformAction(authUser, organizationId, ActionIdConst.CAMPAIGN_MANAGE)
  ) {
    throw new AuthorizationError(REMINDERS_DENIED)
  }
}

type TargetRow = Awaited<ReturnType<typeof getCampaignTargetRowsDao>>[number]

/** Les fiches de l'association et leurs factures, lues par le fournisseur actif. */
const readProfilesAndInvoices = async (
  organizationId: string,
  settings: ResolvedAssociationSettings
): Promise<{rows: TargetRow[]; invoices: MemberInvoice[]}> => {
  const rows = await withTenant(organizationId, () =>
    getCampaignTargetRowsDao(organizationId)
  )
  const invoices = await resolveMemberBillingProvider(settings).listInvoicesOf(
    organizationId,
    [...new Set(rows.map((row) => row.memberProfileId))]
  )
  return {rows, invoices}
}

/** Un rang cree, tel que le calage le lit (ADR 070 §5). */
const rankStateOf = (row: UnpaidReminderRowModel): ReminderRankState => ({
  rank: row.rank,
  finished: row.campaignStatus !== 'sending',
  sentOn: row.lastSentOn,
})

/**
 * La cible d'un rang : les lignes de toutes les fiches, filtrees par les
 * impayes de cette echeance (ADR 070 §2). A appeler sous `withTenant`.
 */
const reminderTargetOf =
  (
    organizationId: string,
    unpaid: ReadonlySet<string>,
    settings: ResolvedAssociationSettings
  ) =>
  async (): Promise<CampaignTargetReading> => {
    const nature = getCampaignNature(settings, UNPAID_REMINDER_SEND_KIND)
    const rows = await getCampaignTargetRowsDao(organizationId)
    const isTargeted = (row: {memberProfileId: string}) =>
      unpaid.has(row.memberProfileId)
    return {
      rows,
      target: computeCampaignTarget(rows, isTargeted, nature),
      isTargeted,
      group: null,
      nature,
    }
  }

/** Cree la campagne du rang du (cible non vide), sous son rang (ADR 070 §6). */
const createDueRank = async (
  organizationId: string,
  settings: ResolvedAssociationSettings,
  reminder: Extract<UnpaidReminderSettings, {enabled: true}>,
  due: {dueOn: string; rank: number; unpaid: ReadonlySet<string>},
  now: Date
): Promise<void> => {
  await createCampaignInTenant({
    organizationId,
    dailySendCap: getCampaignDailySendCap(settings),
    now,
    readTarget: reminderTargetOf(organizationId, due.unpaid, settings),
    content: {
      submissionId: reminderSubmissionIdOf(organizationId, due.dueOn, due.rank),
      subject: reminder.subject,
      preheader: null,
      bodyMarkdown: reminder.body,
      templateId: UNPAID_REMINDER_SEND_KIND,
      targetKind: 'unpaid_members',
      authorUserId: null,
      authorName: null,
      onBehalfOfUserId: null,
      onBehalfOfName: null,
    },
    unpaidReminder: {dueOn: due.dueOn, rank: due.rank},
    acceptsLettersOnly: true,
  })
}

/** Programme la tache d'un jour de Paris ; la cle est le jour. */
const enqueueDay = async (
  organizationId: string,
  day: string,
  runAfter: Date
): Promise<void> => {
  await withTenant(organizationId, () =>
    enqueueScheduledJobTxnDao({
      organizationId,
      kind: BILLING_UNPAID_REMINDERS_JOB_KIND,
      idempotencyKey: day,
      runAfter,
      payload: {day},
    })
  )
}

const enqueueNextDay = (organizationId: string, now: Date): Promise<void> => {
  const nextDay = addDays(calendarDayOf(now), 1)
  return enqueueDay(organizationId, nextDay, partRunAfter(nextDay, now))
}

/**
 * Gestionnaire de `billing.unpaid_reminders`, **sans session** (ADR 070 §4).
 * Desactivee : rien, sans se reprogrammer. Activee : factures lues (une
 * erreur rend `retry` sans rien creer), puis pour chaque echeance portant un
 * impaye, au plus un rang du, cree si sa cible n'est pas vide ; puis le jour
 * suivant est programme.
 */
export const runUnpaidRemindersJobService = async (
  job: ScheduledJob,
  now: Date
): Promise<ScheduledJobOutcome> => {
  const organizationId = job.organizationId
  const settings = await getAssociationSettingsService(organizationId)
  const reminder = getUnpaidReminderSettings(settings)
  if (!reminder.enabled) return {status: 'completed'}

  let invoices: MemberInvoice[]
  try {
    invoices = (await readProfilesAndInvoices(organizationId, settings))
      .invoices
  } catch (error) {
    logger.error('[UNPAID-REMINDER] Factures illisibles, relance reportee', {
      organizationId,
      error: error instanceof Error ? error.name : 'unknown',
    })
    return {
      status: 'retry',
      runAfter: new Date(now.getTime() + retryDelayMs(job.attempts)),
    }
  }

  const classification = getInvoiceStatusClassification(settings)
  const created = await withTenant(organizationId, () =>
    listUnpaidRemindersDao(organizationId)
  )
  const today = calendarDayOf(now)
  for (const dueOn of unpaidDueDatesOf(invoices, classification)) {
    const rank = dueReminderRankOf({
      dueOn,
      delays: reminder.delaysWeeks,
      ranks: created.filter((row) => row.dueOn === dueOn).map(rankStateOf),
      today,
    })
    if (rank === null) continue
    const unpaid = unpaidProfileIdsForDueOn(invoices, classification, dueOn)
    await createDueRank(
      organizationId,
      settings,
      reminder,
      {dueOn, rank, unpaid},
      now
    )
  }

  await enqueueNextDay(organizationId, now)
  return {status: 'completed'}
}

/** Les gestionnaires du planificateur que portent les relances (s29). */
export const unpaidReminderScheduledJobHandlers: ScheduledJobHandlers = {
  [BILLING_UNPAID_REMINDERS_JOB_KIND]: runUnpaidRemindersJobService,
}

/**
 * Garantit la tache quotidienne quand la relance est activee : appele apres
 * le passage de `billing.reminder.enabled` a vrai. Programme le jour meme
 * (tout de suite) et le lendemain : une tache du jour deja passee
 * desactivee ne coupe pas la chaine. Exige `campaign.manage`.
 */
export const scheduleUnpaidRemindersService = async (
  organizationId: string,
  now: Date
): Promise<void> => {
  const orgId = parseOrThrow(organizationIdSchema, organizationId)
  await requireCampaignManager(orgId)
  const reminder = getUnpaidReminderSettings(
    await getAssociationSettingsService(orgId)
  )
  if (!reminder.enabled) return
  await enqueueDay(orgId, calendarDayOf(now), now)
  await enqueueNextDay(orgId, now)
}

type CampaignOfRank = {
  row: UnpaidReminderRowModel
  dto: ReturnType<typeof toCampaignDto>
}

/** Les campagnes des rangs crees, lues avec leurs parts et decomptes. */
const readRankCampaigns = async (
  organizationId: string,
  rows: readonly UnpaidReminderRowModel[]
): Promise<CampaignOfRank[]> => {
  const ids = rows.map((row) => row.campaignId)
  const [parts, counts] = await Promise.all([
    getCampaignPartsDao(ids),
    getRecipientStatusCountsDao(ids),
  ])
  const campaigns: CampaignOfRank[] = []
  for (const row of rows) {
    const campaign = await getCampaignByIdDao(organizationId, row.campaignId)
    if (campaign) {
      campaigns.push({row, dto: toCampaignDto(campaign, parts, counts)})
    }
  }
  return campaigns
}

const createdRankOf = ({row, dto}: CampaignOfRank): UnpaidReminderRankDTO => {
  const deferred = dto.parts.find((part) => part.deferredUntil !== null)
  return {
    rank: row.rank,
    status: 'created',
    campaignId: dto.id,
    day: row.lastSentOn ?? dto.sendDate,
    displayState: dto.displayState,
    recipientCount: dto.recipientCount,
    letterCount: dto.withoutEmailCount,
    receivedCount: dto.recipientCounts.received,
    deferredCount: deferred?.deferredCount ?? 0,
    deferredUntil: deferred?.deferredUntil ?? null,
  }
}

/**
 * Le calendrier ecrit d'une echeance (ecran 1) : les rangs crees avec leur
 * campagne, puis les suivants a leur jour prevu — le prochain « programme »,
 * les autres « a venir », tous « non programmes » si la relance est
 * desactivee.
 */
const scheduleOf = (
  dueOn: string,
  delays: readonly number[],
  enabled: boolean,
  campaigns: readonly CampaignOfRank[]
): UnpaidReminderScheduleDTO => {
  const ranks: UnpaidReminderRankDTO[] = []
  let previous: CampaignOfRank | undefined
  for (let rank = 1; rank <= delays.length; rank += 1) {
    const campaign = campaigns.find(
      (candidate) =>
        candidate.row.dueOn === dueOn && candidate.row.rank === rank
    )
    if (campaign) {
      ranks.push(createdRankOf(campaign))
      previous = campaign
      continue
    }
    const day = plannedReminderDayOf({
      dueOn,
      delays,
      rank,
      previousSentOn:
        previous && previous.row.rank === rank - 1
          ? previous.row.lastSentOn
          : null,
    })
    const isNext =
      rank === 1 ||
      (previous?.row.rank === rank - 1 && previous.dto.status !== 'sending')
    ranks.push({
      rank,
      status: !enabled ? 'not_scheduled' : isNext ? 'scheduled' : 'upcoming',
      day,
    })
    previous = undefined
  }
  return {dueOn, ranks}
}

const byName = (a: {name: string}, b: {name: string}) =>
  a.name.localeCompare(b.name, 'fr')

/** Les fiches en impaye, avec leurs factures et les relances recues. */
const membersOf = (
  rows: readonly TargetRow[],
  unpaidInvoices: readonly MemberInvoice[],
  campaigns: readonly CampaignOfRank[],
  received: Awaited<ReturnType<typeof getReminderRecipientsByProfileDao>>
): UnpaidReminderMemberDTO[] => {
  const rankOf = new Map(campaigns.map(({row}) => [row.campaignId, row]))
  const sendDateOf = new Map(campaigns.map(({dto}) => [dto.id, dto.sendDate]))
  const profiles = new Map<string, TargetRow[]>()
  for (const row of rows) {
    profiles.set(row.memberProfileId, [
      ...(profiles.get(row.memberProfileId) ?? []),
      row,
    ])
  }

  const members: UnpaidReminderMemberDTO[] = []
  for (const [id, profileRows] of profiles) {
    const invoices = unpaidInvoices.filter(
      (invoice) => invoice.memberProfileId === id
    )
    if (invoices.length === 0) continue
    const dueDates = new Set(invoices.map((invoice) => invoice.dueOn))
    const reminderOf = (
      campaignId: string,
      day: string | undefined,
      channel: UnpaidReminderReceivedDTO['channel']
    ): UnpaidReminderReceivedDTO[] => {
      const rank = rankOf.get(campaignId)
      return rank && day && dueDates.has(rank.dueOn)
        ? [{rank: rank.rank, day, channel}]
        : []
    }
    const reminders = [
      ...received.emails
        .filter((email) => email.memberProfileId === id)
        .flatMap((email) =>
          reminderOf(email.campaignId, calendarDayOf(email.sentAt), 'email')
        ),
      ...received.letters
        .filter((letter) => letter.memberProfileId === id)
        .flatMap((letter) =>
          reminderOf(
            letter.campaignId,
            sendDateOf.get(letter.campaignId),
            'letter'
          )
        ),
    ].sort((a, b) => a.rank - b.rank)
    members.push({
      id,
      name: profileRows[0].name,
      parcelNumbers: [...profileRows[0].currentParcelNumbers],
      invoices: invoices.map((invoice) => ({
        issuedOn: invoice.issuedOn,
        dueOn: invoice.dueOn,
        parcelNumber: invoice.parcelNumber,
      })),
      reminders,
      channel: profileRows.some((row) => row.email !== null)
        ? 'email'
        : 'letter',
    })
  }
  return members.sort(byName)
}

/**
 * La page de suivi (ecran 1, critere 9), sous `campaign.manage`. Liste
 * blanche, sans adresse ni jeton. Des factures illisibles rendent
 * `unavailable`, jamais une liste vide.
 */
export const getUnpaidRemindersOverviewService = async (
  input: UnpaidRemindersOverviewInput
): Promise<UnpaidRemindersOverviewDTO> => {
  const data = parseOrThrow(overviewInputSchema, input)
  await requireCampaignManager(data.organizationId)
  const settings = await getAssociationSettingsService(data.organizationId)
  const reminder = getUnpaidReminderSettings(settings)
  const enabled = reminder.enabled
  const delaysWeeks = reminder.delaysWeeks

  let read: {rows: TargetRow[]; invoices: MemberInvoice[]}
  try {
    read = await readProfilesAndInvoices(data.organizationId, settings)
  } catch (error) {
    logger.error('[UNPAID-REMINDER] Factures illisibles pour le suivi', {
      organizationId: data.organizationId,
      error: error instanceof Error ? error.name : 'unknown',
    })
    return {status: 'unavailable', enabled, delaysWeeks}
  }

  const classification = getInvoiceStatusClassification(settings)
  const unpaidInvoices = read.invoices.filter((invoice) =>
    isUnpaidInvoice(invoice.status, classification)
  )
  const {campaigns, received} = await withTenant(
    data.organizationId,
    async () => {
      const rows = await listUnpaidRemindersDao(data.organizationId)
      const ofRanks = await readRankCampaigns(data.organizationId, rows)
      return {
        campaigns: ofRanks,
        received: await getReminderRecipientsByProfileDao(
          data.organizationId,
          ofRanks.map(({row}) => row.campaignId)
        ),
      }
    }
  )

  const rankCount = BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS.length
  const delays =
    delaysWeeks ?? BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS.map(() => 0)
  const members = membersOf(read.rows, unpaidInvoices, campaigns, received)
  const byEmail = members.filter((member) => member.channel === 'email').length
  const offset = (data.page - 1) * UNPAID_REMINDERS_PAGE_SIZE
  return {
    status: 'ready',
    enabled,
    delaysWeeks,
    rankCount,
    schedules: unpaidDueDatesOf(unpaidInvoices, classification).map((dueOn) =>
      scheduleOf(dueOn, delays, enabled, campaigns)
    ),
    members: {
      items: members.slice(offset, offset + UNPAID_REMINDERS_PAGE_SIZE),
      page: data.page,
      pageSize: UNPAID_REMINDERS_PAGE_SIZE,
      total: members.length,
      totalPages: Math.max(
        1,
        Math.ceil(members.length / UNPAID_REMINDERS_PAGE_SIZE)
      ),
    },
    counts: {
      unpaid: members.length,
      byEmail,
      byLetter: members.length - byEmail,
    },
  }
}
