import 'server-only'

import {randomBytes} from 'node:crypto'

import {render} from 'react-email'
import {z} from 'zod'

import {
  claimRecipientForSendTxnDao,
  countUnfinishedCampaignPartsDao,
  createCampaignWithRecipientsTxnDao,
  failCampaignPartsFromTxnDao,
  failUnreceivedRecipientsTxnDao,
  finishCampaignPartTxnDao,
  finishCampaignTxnDao,
  getAllottedRecipientsByDayDao,
  getCampaignByIdDao,
  getCampaignPartDao,
  getCampaignPartsDao,
  getCampaignRecipientsPageDao,
  getCampaignsPageDao,
  getCampaignTargetRowsDao,
  getCurrentParcelNumbersForMembersDao,
  getPendingPartRecipientsDao,
  getRecipientStatusCountsDao,
  lockCampaignScheduleTxnDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
  markRecipientToVerifyTxnDao,
  markRecipientUnsubscribedTxnDao,
  markSendingRecipientsToVerifyTxnDao,
  markStaleSendingRecipientsToVerifyTxnDao,
  type PendingRecipientRowModel,
  releaseRecipientClaimTxnDao,
  startCampaignPartTxnDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import CampaignMail, {
  type CampaignEmailAssociation,
  getCampaignFooterTexts,
} from '@/lib/emails/campaign-email'
import {renderCampaignText} from '@/lib/emails/campaign-text'
import {pngLogoUrlOf} from '@/lib/emails/logo-url'
import {renderCampaignBodyHtml} from '@/lib/emails/render-campaign-body'
import {isEmailTransportError} from '@/lib/emails/transport/email-transport'
import {PRODUCT_LOCALE} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getActingContext, getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {isClientEmailEnabledService, sendEmailService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  computeCampaignTarget,
  finalSubject,
  findUnknownVariables,
  formatCampaignDate,
  joinParcelNumbers,
  subjectMaxLength,
  substituteVariables,
  toCampaignDto,
} from './rules/campaign-rules'
import {
  partRunAfter,
  planCampaignParts,
  retryDelayMs,
} from './rules/campaign-schedule-rules'
import {runDueScheduledJobsService} from './scheduled-job-service'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
  ASSOCIATION_LEGAL_NAME_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  getAccentHue,
  getCampaignDailySendCap,
  getCampaignSendMaxAttempts,
  type ResolvedAssociationSettings,
} from './types/domain/association-settings-types'
import {
  CAMPAIGN_RECIPIENT_SENDING_STALE_MS,
  CAMPAIGN_RECIPIENTS_PAGE_SIZE,
  CAMPAIGN_SUBJECT_MAX_TOTAL,
  CampaignByIdInput,
  CampaignComposerContextDTO,
  CampaignListPageDTO,
  CampaignPlanDTO,
  CampaignReadResult,
  CampaignRecipientFilter,
  CampaignRecipientsInput,
  CampaignRecipientsReadResult,
  CampaignRecipientStatus,
  CAMPAIGNS_PAGE_SIZE,
  CampaignsPageInput,
  CampaignTargetCountsDTO,
  CampaignVariableValues,
  PreviewCampaignInput,
  PreviewCampaignResult,
  SendCampaignInput,
  SendCampaignResult,
  UNSUBSCRIBE_TOKEN_BYTES,
} from './types/domain/campaign-types'
import {effectiveAuthor} from './types/domain/impersonation-types'
import {
  CAMPAIGN_DELIVER_PART_JOB_KIND,
  ScheduledJob,
  ScheduledJobHandlers,
  ScheduledJobOutcome,
} from './types/domain/scheduled-job-types'
import {calendarDayOf} from './types/domain/water-analysis-types'
import {
  campaignByIdServiceSchema,
  campaignRecipientsServiceSchema,
  campaignsPageServiceSchema,
  createPreviewCampaignServiceSchema,
  createSendCampaignServiceSchema,
} from './validation/campaign-validation'

/**
 * Campagnes email (s25, ADR 051). Reservees au bureau : chaque fonction
 * exportee avec facade valide l'entree, puis exige `campaign.manage` sur
 * l'association. Le contenu d'une campagne et ses destinataires sont des
 * donnees personnelles : jamais dans un journal (intercepteur sans details,
 * erreurs journalisees sans message).
 *
 * `deliverCampaignPartService` n'a **pas** de facade de campagne : c'est le
 * gestionnaire du planificateur (s26, ADR 052), lance par une tache creee
 * apres l'autorisation et la creation des lignes.
 */

const CAMPAIGNS_DENIED =
  "Seul le bureau de l'association peut gerer les campagnes email"
const ASSOCIATION_NOT_FOUND = 'Association introuvable'
const UNSUBSCRIBE_PAGE_PATH = '/desinscription'
const UNSUBSCRIBE_API_PATH = '/api/campaigns/unsubscribe'
/** Segment de l'URL de desinscription d'un apercu : aucun jeton n'existe. */
const PREVIEW_UNSUBSCRIBE_SEGMENT = 'apercu'

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
    throw new AuthorizationError(CAMPAIGNS_DENIED)
  }
  return authUser
}

/**
 * L'association telle qu'un envoi la montre, son origine publique et son
 * rythme d'envoi (s26 : plafond quotidien, tentatives d'une part).
 */
type CampaignAssociation = CampaignEmailAssociation & {
  replyTo: string | null
  origin: string
  dailySendCap: number
  sendMaxAttempts: number
}

/** Un reglage texte renseigne, ou rien. */
const textSettingOf = (
  settings: ResolvedAssociationSettings,
  key: string
): string | null => {
  const value = settings[key]?.value
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

const readAssociation = async (
  organizationId: string
): Promise<CampaignAssociation> => {
  const [settings, organization] = await Promise.all([
    getAssociationSettingsService(organizationId),
    getOrganizationByIdDao(organizationId),
  ])
  const origin = associationOriginOf(organization?.domain)
  if (!organization || !origin) throw new NotFoundError(ASSOCIATION_NOT_FOUND)

  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  return {
    name: organization.name,
    hue: getAccentHue(settings),
    ...(logoUrl ? {logoUrl} : {}),
    legalName: textSettingOf(settings, ASSOCIATION_LEGAL_NAME_SETTING_KEY),
    legalMentions: textSettingOf(
      settings,
      ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY
    ),
    replyTo: textSettingOf(settings, CONTACT_EMAIL_SETTING_KEY),
    origin,
    dailySendCap: getCampaignDailySendCap(settings),
    sendMaxAttempts: getCampaignSendMaxAttempts(settings),
  }
}

const unknownVariablesOf = (content: {
  subject: string
  preheader: string
  bodyMarkdown: string
}): string[] =>
  findUnknownVariables(
    `${content.subject}\n${content.preheader}\n${content.bodyMarkdown}`
  )

const countsOf = (
  target: ReturnType<typeof computeCampaignTarget>
): CampaignTargetCountsDTO => ({
  recipients: target.recipients.length,
  withoutEmail: target.withoutEmail,
  unsubscribed: target.unsubscribed,
  total: target.recipients.length + target.withoutEmail + target.unsubscribed,
})

const readTarget = async (organizationId: string) =>
  computeCampaignTarget(await getCampaignTargetRowsDao(organizationId))

const unsubscribeUrlOf = (origin: string, token: string): string =>
  `${origin}${UNSUBSCRIBE_PAGE_PATH}/${encodeURIComponent(token)}`

type CampaignEmail = {
  subject: string
  preheader: string | null
  /** Le gabarit commun, rendu en HTML par l'apercu ou par l'envoi. */
  template: ReturnType<typeof CampaignMail>
  text: string
}

/** Un envoi pour un destinataire : objet final, gabarit, version texte. */
const buildCampaignEmail = async (
  association: CampaignAssociation,
  content: {subject: string; preheader: string | null; bodyMarkdown: string},
  values: CampaignVariableValues,
  unsubscribeUrl: string
): Promise<CampaignEmail> => {
  const plain = (value: string) => value
  const heading = substituteVariables(content.subject, values, plain)
  const preheader = content.preheader
    ? substituteVariables(content.preheader, values, plain)
    : null
  const footer = await getCampaignFooterTexts(PRODUCT_LOCALE, association)
  return {
    subject: finalSubject(association.name, heading),
    preheader,
    template: CampaignMail({
      locale: PRODUCT_LOCALE,
      association,
      heading,
      preheader,
      bodyHtml: renderCampaignBodyHtml(content.bodyMarkdown, values),
      unsubscribeUrl,
    }),
    text: renderCampaignText({
      heading,
      bodyMarkdown: content.bodyMarkdown,
      values,
      footer,
      unsubscribeUrl,
    }),
  }
}

const valuesOf = (
  name: string,
  parcelNumbers: readonly string[],
  sendDate: string
): CampaignVariableValues => ({
  nom: name,
  parcelle: joinParcelNumbers(parcelNumbers),
  date: formatCampaignDate(sendDate),
})

/** Le composeur : decompte de la cible, adresse de reponse, plafond d'objet. */
export const getCampaignComposerContextService = async (
  organizationId: string
): Promise<CampaignComposerContextDTO> => {
  const orgId = parseOrThrow(z.string().uuid(), organizationId)
  await requireCampaignManager(orgId)
  const association = await readAssociation(orgId)

  const target = await withTenant(orgId, () => readTarget(orgId))
  return {
    associationName: association.name,
    replyTo: association.replyTo,
    subjectMaxLength: subjectMaxLength(association.name),
    counts: countsOf(target),
    reachableMembers: target.recipients.map((row) => ({
      id: row.memberProfileId,
      name: row.name,
    })),
  }
}

/**
 * L'apercu avec un destinataire reel de **cette** association (critere 5).
 * N'ecrit rien, n'envoie rien. Le membre demande n'est retenu que s'il est
 * joignable ; sinon le premier joignable.
 */
export const previewCampaignService = async (
  input: PreviewCampaignInput
): Promise<PreviewCampaignResult> => {
  parseOrThrow(
    createPreviewCampaignServiceSchema(CAMPAIGN_SUBJECT_MAX_TOTAL),
    input
  )
  await requireCampaignManager(input.organizationId)
  const association = await readAssociation(input.organizationId)
  const data = parseOrThrow(
    createPreviewCampaignServiceSchema(subjectMaxLength(association.name)),
    input
  )

  const unknown = unknownVariablesOf(data)
  if (unknown.length > 0)
    return {status: 'unknown_variables', variables: unknown}

  return withTenant(data.organizationId, async () => {
    const target = await readTarget(data.organizationId)
    const member =
      target.recipients.find(
        (row) => row.memberProfileId === data.memberProfileId
      ) ?? target.recipients[0]
    if (!member) return {status: 'no_recipient'}

    const parcels = await getCurrentParcelNumbersForMembersDao([
      member.memberProfileId,
    ])
    const values = valuesOf(
      member.name,
      parcels[member.memberProfileId] ?? [],
      calendarDayOf(new Date())
    )
    const email = await buildCampaignEmail(
      association,
      {...data, preheader: data.preheader || null},
      values,
      unsubscribeUrlOf(association.origin, PREVIEW_UNSUBSCRIBE_SEGMENT)
    )
    return {
      status: 'ok',
      preview: {
        member: {id: member.memberProfileId, name: member.name},
        subject: email.subject,
        preheader: email.preheader,
        html: await render(await email.template),
        text: email.text,
        counts: countsOf(target),
      },
    }
  })
}

const newUnsubscribeToken = (): string =>
  randomBytes(UNSUBSCRIBE_TOKEN_BYTES).toString('base64url')

/**
 * Cree la campagne et ses lignes de destinataire (ADR 051). Ordre :
 * validation -> autorisation -> auteur lu **avant** `withTenant` -> envoi
 * permis par les reglages (sinon refus sans ecriture) -> sous le scope :
 * cible recalculee, refus d'une variable inconnue ou d'une cible vide,
 * creation. N'envoie rien : la livraison est rendue a l'appelant, qui la pose
 * dans `after()` ; une soumission deja connue n'en rend aucune.
 */
export const sendCampaignService = async (
  input: SendCampaignInput
): Promise<SendCampaignResult> => {
  parseOrThrow(
    createSendCampaignServiceSchema(CAMPAIGN_SUBJECT_MAX_TOTAL),
    input
  )
  const authUser = await requireCampaignManager(input.organizationId)
  const author = effectiveAuthor(
    authUser,
    (await getActingContext())?.impersonator
  )

  if (!(await isClientEmailEnabledService())) {
    return {status: 'delivery_disabled'}
  }

  const association = await readAssociation(input.organizationId)
  const data = parseOrThrow(
    createSendCampaignServiceSchema(subjectMaxLength(association.name)),
    input
  )
  const unknown = unknownVariablesOf(data)
  if (unknown.length > 0)
    return {status: 'unknown_variables', variables: unknown}

  const now = new Date()
  const today = calendarDayOf(now)
  return withTenant(data.organizationId, async () => {
    const target = await readTarget(data.organizationId)
    if (target.recipients.length === 0) return {status: 'no_recipient'}

    await lockCampaignScheduleTxnDao(data.organizationId)
    const plan = planCampaignParts(
      target.recipients.length,
      association.dailySendCap,
      await getAllottedRecipientsByDayDao(data.organizationId, today),
      today
    )

    const result = await createCampaignWithRecipientsTxnDao(
      {
        organizationId: data.organizationId,
        submissionId: data.submissionId,
        subject: data.subject,
        preheader: data.preheader || null,
        bodyMarkdown: data.bodyMarkdown,
        templateId: data.templateId,
        targetKind: 'all_members',
        recipientCount: target.recipients.length,
        withoutEmailCount: target.withoutEmail,
        unsubscribedCount: target.unsubscribed,
        status: 'sending',
        sendDate: today,
        ...author,
      },
      plan.map((part, index) => ({
        number: index + 1,
        scheduledFor: part.day,
        recipientCount: part.count,
      })),
      target.recipients.map((row) => ({
        memberProfileId: row.memberProfileId,
        unsubscribeToken: newUnsubscribeToken(),
      }))
    )
    if (!result) throw new NotFoundError(ASSOCIATION_NOT_FOUND)

    const campaignId = result.campaign.id
    for (const part of result.parts) {
      await enqueueScheduledJobTxnDao({
        organizationId: data.organizationId,
        kind: CAMPAIGN_DELIVER_PART_JOB_KIND,
        idempotencyKey: part.id,
        runAfter: partRunAfter(part.scheduledFor, now),
        payload: {partId: part.id, campaignId},
      })
    }
    return {
      status: 'created',
      campaignId,
      deliver: result.created
        ? () => runImmediatePass(data.organizationId)
        : null,
    }
  })
}

/**
 * Le plan d'envoi que l'apercu annonce (ecran 1 de s26) : lecture seule, sans
 * verrou. Le plan reel est recalcule sous verrou a la creation.
 */
export const previewCampaignPlanService = async (
  organizationId: string
): Promise<CampaignPlanDTO> => {
  const orgId = parseOrThrow(z.string().uuid(), organizationId)
  await requireCampaignManager(orgId)
  const association = await readAssociation(orgId)

  const today = calendarDayOf(new Date())
  return withTenant(orgId, async () => {
    const target = await readTarget(orgId)
    const allotted = await getAllottedRecipientsByDayDao(orgId, today)
    return {
      today,
      dailySendCap: association.dailySendCap,
      allottedToday: allotted[today] ?? 0,
      parts: planCampaignParts(
        target.recipients.length,
        association.dailySendCap,
        allotted,
        today
      ),
    }
  })
}

/** Les campagnes lues, avec leurs parts et leurs decomptes (s26). */
const withPartsAndCounts = async (
  rows: Awaited<ReturnType<typeof getCampaignsPageDao>>['rows']
) => {
  const ids = rows.map((row) => row.id)
  const [parts, counts] = await Promise.all([
    getCampaignPartsDao(ids),
    getRecipientStatusCountsDao(ids),
  ])
  return rows.map((row) => toCampaignDto(row, parts, counts))
}

/** Une page de l'archive, la plus recente d'abord (critere 8). */
export const listCampaignsService = async (
  input: CampaignsPageInput
): Promise<CampaignListPageDTO> => {
  const data = parseOrThrow(campaignsPageServiceSchema, input)
  await requireCampaignManager(data.organizationId)

  const {items, total} = await withTenant(data.organizationId, async () => {
    const {rows, total} = await getCampaignsPageDao({
      organizationId: data.organizationId,
      limit: CAMPAIGNS_PAGE_SIZE,
      offset: (data.page - 1) * CAMPAIGNS_PAGE_SIZE,
    })
    return {items: await withPartsAndCounts(rows), total}
  })
  return {
    items,
    page: data.page,
    pageSize: CAMPAIGNS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE)),
  }
}

/** Une campagne de l'association ; celle d'une autre est introuvable. */
export const getCampaignService = async (
  input: CampaignByIdInput
): Promise<CampaignReadResult> => {
  const data = parseOrThrow(campaignByIdServiceSchema, input)
  await requireCampaignManager(data.organizationId)

  const campaign = await withTenant(data.organizationId, async () => {
    const row = await getCampaignByIdDao(data.organizationId, data.campaignId)
    return row ? (await withPartsAndCounts([row]))[0] : undefined
  })
  return campaign ? {status: 'found', campaign} : {status: 'not_found'}
}

const STATUSES_OF_FILTER: Record<
  CampaignRecipientFilter,
  CampaignRecipientStatus[] | null
> = {
  all: null,
  received: ['sent'],
  scheduled: ['pending', 'sending'],
  to_verify: ['to_verify'],
  failed: ['failed'],
}

/**
 * Les destinataires d'une campagne de l'association, pagines et filtres par
 * etat (ecran 2 de s26, critere 6). Une campagne d'une autre association est
 * introuvable, sans qu'aucune ligne ne soit lue. Aucun jeton n'en sort.
 */
export const getCampaignRecipientsService = async (
  input: CampaignRecipientsInput
): Promise<CampaignRecipientsReadResult> => {
  const data = parseOrThrow(campaignRecipientsServiceSchema, input)
  await requireCampaignManager(data.organizationId)

  const page = await withTenant(data.organizationId, async () => {
    const campaign = await getCampaignByIdDao(
      data.organizationId,
      data.campaignId
    )
    if (!campaign) return undefined
    return getCampaignRecipientsPageDao({
      organizationId: data.organizationId,
      campaignId: data.campaignId,
      statuses: STATUSES_OF_FILTER[data.filter],
      limit: CAMPAIGN_RECIPIENTS_PAGE_SIZE,
      offset: (data.page - 1) * CAMPAIGN_RECIPIENTS_PAGE_SIZE,
    })
  })
  if (!page) return {status: 'not_found'}

  return {
    status: 'found',
    recipients: {
      items: page.rows.map((row) => ({
        id: row.id,
        name: row.name,
        parcelNumbers: row.parcelNumbers,
        status: row.status,
        sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        scheduledFor: row.scheduledFor,
      })),
      filter: data.filter,
      page: data.page,
      pageSize: CAMPAIGN_RECIPIENTS_PAGE_SIZE,
      total: page.total,
      totalPages: Math.max(
        1,
        Math.ceil(page.total / CAMPAIGN_RECIPIENTS_PAGE_SIZE)
      ),
    },
  }
}

const listUnsubscribeHeaders = (
  origin: string,
  token: string
): Record<string, string> => ({
  'List-Unsubscribe': `<${origin}${UNSUBSCRIBE_API_PATH}/${encodeURIComponent(token)}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
})

const sendToRecipient = async (
  association: CampaignAssociation,
  campaign: {subject: string; preheader: string | null; bodyMarkdown: string},
  sendDate: string,
  recipient: PendingRecipientRowModel & {email: string; name: string}
): Promise<void> => {
  const email = await buildCampaignEmail(
    association,
    campaign,
    valuesOf(recipient.name, recipient.parcelNumbers, sendDate),
    unsubscribeUrlOf(association.origin, recipient.unsubscribeToken)
  )
  await sendEmailService(
    {
      to: recipient.email,
      subject: email.subject,
      text: email.text,
      react: email.template,
      senderName: association.name,
      ...(association.replyTo ? {replyTo: association.replyTo} : {}),
      headers: listUnsubscribeHeaders(
        association.origin,
        recipient.unsubscribeToken
      ),
    },
    {recipientType: 'client'}
  )
}

/**
 * L'utilisateur connecte peut-il gerer les campagnes de cette association ?
 * Pour les ecrans : un refus se lit, il ne se leve pas.
 */
export const canManageCampaignsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = z.string().uuid().safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(authUser, parsed.data, ActionIdConst.CAMPAIGN_MANAGE)
}

/**
 * Le passage immediat des taches dues de l'association, pose dans `after()`
 * par l'action : la premiere part n'attend pas la minuterie.
 */
const runImmediatePass = async (organizationId: string): Promise<void> => {
  await runDueScheduledJobsService({
    handlers: campaignScheduledJobHandlers,
    now: new Date(),
    organizationId,
  })
}

type CampaignContent = {
  id: string
  subject: string
  preheader: string | null
  bodyMarkdown: string
}

type PartToDeliver = {
  id: string
  campaignId: string
  number: number
  scheduledFor: string
}

/** Un refus certain du fournisseur : l'email n'est pas parti. */
const isCertainRefusal = (error: unknown): boolean =>
  isEmailTransportError(error) && error.refused

/**
 * Un destinataire de la part. `pending -> sending` **avant** l'envoi ; une
 * ligne deja prise ailleurs est laissee. Rend `false` sur un echec d'envoi :
 * la ligne est rendue en attente (refus certain) ou mise a verifier.
 */
const deliverToRecipient = async (
  organizationId: string,
  association: CampaignAssociation,
  campaign: CampaignContent,
  part: PartToDeliver,
  recipient: PendingRecipientRowModel
): Promise<boolean> => {
  const inTenant = <T>(callback: () => Promise<T>) =>
    withTenant(organizationId, callback)

  if (recipient.unsubscribed) {
    await inTenant(() => markRecipientUnsubscribedTxnDao(recipient.recipientId))
    return true
  }
  const {email, name} = recipient
  if (!email || name === null) {
    await inTenant(() => markRecipientFailedTxnDao(recipient.recipientId))
    return true
  }
  if (
    !(await inTenant(() => claimRecipientForSendTxnDao(recipient.recipientId)))
  ) {
    return true
  }

  try {
    await sendToRecipient(association, campaign, part.scheduledFor, {
      ...recipient,
      email,
      name,
    })
  } catch (error) {
    logger.error("[CAMPAIGN] Envoi d'une part interrompu", {
      campaignId: campaign.id,
      partId: part.id,
      refused: isCertainRefusal(error),
      error: error instanceof Error ? error.name : 'unknown',
    })
    await inTenant(() =>
      isCertainRefusal(error)
        ? releaseRecipientClaimTxnDao(recipient.recipientId)
        : markRecipientToVerifyTxnDao(recipient.recipientId)
    )
    return false
  }
  await inTenant(() => markRecipientSentTxnDao(recipient.recipientId))
  return true
}

/**
 * Un echec arrete la part. Tentatives restantes : nouvelle tentative a
 * +30 min x tentative. Epuisees : la part, les suivantes et les non-recus
 * passent en echec, la campagne `interrupted`.
 */
const failedAttemptOutcome = async (
  job: ScheduledJob,
  now: Date,
  part: PartToDeliver,
  maxAttempts: number
): Promise<ScheduledJobOutcome> => {
  if (job.attempts < maxAttempts) {
    return {
      status: 'retry',
      runAfter: new Date(now.getTime() + retryDelayMs(job.attempts)),
    }
  }
  await withTenant(job.organizationId, async () => {
    await failCampaignPartsFromTxnDao(part.campaignId, part.number)
    await failUnreceivedRecipientsTxnDao(part.campaignId)
    await finishCampaignTxnDao(part.campaignId, 'interrupted')
  })
  return {status: 'failed'}
}

/**
 * Les lignes `sending` laissees par un passage precedent passent a verifier.
 * Reprise sur un verrou perime : son detenteur est mort, **toutes** ses
 * lignes en cours sont abandonnees, quel que soit leur age. Premiere
 * execution : seules les lignes plus vieilles que le seuil.
 */
const sweepAbandonedRecipients = async (
  job: ScheduledJob,
  partId: string,
  now: Date
): Promise<void> => {
  if (job.resumedAfterStaleLock) {
    await markSendingRecipientsToVerifyTxnDao(partId)
    return
  }
  await markStaleSendingRecipientsToVerifyTxnDao(
    partId,
    new Date(now.getTime() - CAMPAIGN_RECIPIENT_SENDING_STALE_MS)
  )
}

/**
 * La part est servie ; la campagne n'est `sent` qu'a la derniere. Une part ne
 * se clot **jamais** sur une ligne `sending` : ce passage a fini les siennes,
 * toute ligne encore en cours est abandonnee et passe a verifier, visible du
 * bureau, jamais renvoyee.
 */
const finishPart = async (
  organizationId: string,
  part: PartToDeliver
): Promise<void> => {
  await withTenant(organizationId, async () => {
    await markSendingRecipientsToVerifyTxnDao(part.id)
    await finishCampaignPartTxnDao(part.id, 'sent')
    if ((await countUnfinishedCampaignPartsDao(part.campaignId)) === 0) {
      await finishCampaignTxnDao(part.campaignId, 'sent')
    }
  })
}

/**
 * La livraison d'une part (ADR 052), gestionnaire de `campaign.deliver_part`,
 * **sans session**. Dans l'ordre : balayage des lignes `sending` abandonnees
 * (`to_verify`, jamais renvoyees ; toutes sur une reprise), part `sending`, puis chaque
 * destinataire `pending` de la part, sequentiellement, un `withTenant` court
 * par etape. `{date}` vaut le jour de la part. Des envois desactives par les
 * reglages rendent la tache sans compter de tentative.
 */
export const deliverCampaignPartService = async (
  job: ScheduledJob,
  now: Date
): Promise<ScheduledJobOutcome> => {
  const organizationId = job.organizationId
  const part = await withTenant(organizationId, () =>
    getCampaignPartDao(job.payload.partId)
  )
  if (!part || part.status === 'sent' || part.status === 'failed') {
    return {status: 'completed'}
  }
  if (!(await isClientEmailEnabledService())) return {status: 'released'}

  const association = await readAssociation(organizationId)
  const {campaign, recipients} = await withTenant(organizationId, async () => {
    await sweepAbandonedRecipients(job, part.id, now)
    await startCampaignPartTxnDao(part.id)
    return {
      campaign: await getCampaignByIdDao(organizationId, part.campaignId),
      recipients: await getPendingPartRecipientsDao(part.id),
    }
  })
  if (!campaign) return {status: 'completed'}

  for (const recipient of recipients) {
    const delivered = await deliverToRecipient(
      organizationId,
      association,
      campaign,
      part,
      recipient
    )
    if (!delivered) {
      return failedAttemptOutcome(job, now, part, association.sendMaxAttempts)
    }
  }

  await finishPart(organizationId, part)
  return {status: 'completed'}
}

/** Les gestionnaires du planificateur que portent les campagnes (s26). */
export const campaignScheduledJobHandlers: ScheduledJobHandlers = {
  [CAMPAIGN_DELIVER_PART_JOB_KIND]: deliverCampaignPartService,
}
