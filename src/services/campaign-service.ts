import 'server-only'

import {randomBytes} from 'node:crypto'

import {render} from 'react-email'
import {z} from 'zod'

import {
  createCampaignWithRecipientsTxnDao,
  finishCampaignTxnDao,
  getCampaignByIdDao,
  getCampaignsPageDao,
  getCampaignTargetRowsDao,
  getCurrentParcelNumbersForMembersDao,
  getPendingRecipientsDao,
  markRecipientFailedTxnDao,
  markRecipientSentTxnDao,
  type PendingRecipientRowModel,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import CampaignMail, {
  type CampaignEmailAssociation,
  getCampaignFooterTexts,
} from '@/lib/emails/campaign-email'
import {renderCampaignText} from '@/lib/emails/campaign-text'
import {pngLogoUrlOf} from '@/lib/emails/logo-url'
import {renderCampaignBodyHtml} from '@/lib/emails/render-campaign-body'
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
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
  ASSOCIATION_LEGAL_NAME_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  getAccentHue,
  type ResolvedAssociationSettings,
} from './types/domain/association-settings-types'
import {
  CAMPAIGN_SUBJECT_MAX_TOTAL,
  CampaignByIdInput,
  CampaignComposerContextDTO,
  CampaignListPageDTO,
  CampaignReadResult,
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
import {calendarDayOf} from './types/domain/water-analysis-types'
import {
  campaignByIdServiceSchema,
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
 * `deliverCampaignService` n'a **pas** de facade : la livraison n'est lancee
 * que par la fonction rendue par `sendCampaignService`, apres l'autorisation
 * et la creation des lignes.
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

/** L'association telle qu'un envoi la montre, et son origine publique. */
type CampaignAssociation = CampaignEmailAssociation & {
  replyTo: string | null
  origin: string
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

  return withTenant(data.organizationId, async () => {
    const target = await readTarget(data.organizationId)
    if (target.recipients.length === 0) return {status: 'no_recipient'}

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
        sendDate: calendarDayOf(new Date()),
        ...author,
      },
      target.recipients.map((row) => ({
        memberProfileId: row.memberProfileId,
        unsubscribeToken: newUnsubscribeToken(),
      }))
    )
    if (!result) throw new NotFoundError(ASSOCIATION_NOT_FOUND)

    const campaignId = result.campaign.id
    return {
      status: 'created',
      campaignId,
      deliver: result.created
        ? () => deliverCampaignService(data.organizationId, campaignId)
        : null,
    }
  })
}

/** Une page de l'archive, la plus recente d'abord (critere 8). */
export const listCampaignsService = async (
  input: CampaignsPageInput
): Promise<CampaignListPageDTO> => {
  const data = parseOrThrow(campaignsPageServiceSchema, input)
  await requireCampaignManager(data.organizationId)

  const {rows, total} = await withTenant(data.organizationId, () =>
    getCampaignsPageDao({
      organizationId: data.organizationId,
      limit: CAMPAIGNS_PAGE_SIZE,
      offset: (data.page - 1) * CAMPAIGNS_PAGE_SIZE,
    })
  )
  return {
    items: rows.map(toCampaignDto),
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

  const row = await withTenant(data.organizationId, () =>
    getCampaignByIdDao(data.organizationId, data.campaignId)
  )
  return row
    ? {status: 'found', campaign: toCampaignDto(row)}
    : {status: 'not_found'}
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
  recipient: PendingRecipientRowModel
): Promise<void> => {
  if (!recipient.email) throw new Error('Destinataire sans adresse')

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

const interrupt = async (
  organizationId: string,
  campaignId: string,
  failedRecipientId?: string
): Promise<void> => {
  await withTenant(organizationId, async () => {
    if (failedRecipientId) await markRecipientFailedTxnDao(failedRecipientId)
    await finishCampaignTxnDao(campaignId, 'interrupted')
  })
}

/**
 * La livraison d'une campagne (ADR 051), **sans facade et sans session** :
 * sequentielle, un `withTenant` court par destinataire (jamais une
 * transaction de tout l'envoi), arretee au **premier echec** (`interrupted`,
 * restants `pending`). Aucune reprise en V1 (s26).
 */
export const deliverCampaignService = async (
  organizationId: string,
  campaignId: string
): Promise<void> => {
  try {
    const campaign = await withTenant(organizationId, () =>
      getCampaignByIdDao(organizationId, campaignId)
    )
    if (!campaign || campaign.status !== 'sending') return

    if (!(await isClientEmailEnabledService())) {
      await interrupt(organizationId, campaignId)
      return
    }

    const association = await readAssociation(organizationId)
    const recipients = await withTenant(organizationId, () =>
      getPendingRecipientsDao(campaignId)
    )

    for (const recipient of recipients) {
      try {
        await sendToRecipient(
          association,
          campaign,
          campaign.sendDate,
          recipient
        )
      } catch (error) {
        logger.error('[CAMPAIGN] Envoi interrompu au premier echec', {
          campaignId,
          error: error instanceof Error ? error.name : 'unknown',
        })
        await interrupt(organizationId, campaignId, recipient.recipientId)
        return
      }
      await withTenant(organizationId, () =>
        markRecipientSentTxnDao(recipient.recipientId)
      )
    }

    await withTenant(organizationId, () =>
      finishCampaignTxnDao(campaignId, 'sent')
    )
  } catch (error) {
    logger.error('[CAMPAIGN] Livraison en echec', {
      campaignId,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
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
