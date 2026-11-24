import 'server-only'

import {createTranslator} from 'next-intl'
import {z} from 'zod'

import {
  getAllottedRecipientsByDayDao,
  getCampaignPartsDao,
  getCampaignsByTemplateIdsDao,
  getCampaignTargetRowsDao,
  getRecipientStatusCountsDao,
} from '@/db/repositories/campaign-repository'
import {getInvitationStatesByEmailsDao} from '@/db/repositories/member-invitation-state-repository'
import {getInvitationAddressesDao} from '@/db/repositories/member-profile-email-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {PRODUCT_LOCALE} from '@/lib/helper/locale-helper'

import fr from '../../messages/fr.json'
import {getAssociationSettingsService} from './association-settings-service'
import {getActingContext, getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {
  type CampaignTargetReading,
  createCampaignInTenant,
  runImmediateCampaignPass,
} from './campaign-service'
import {isClientEmailEnabledService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  type CampaignTargetPredicate,
  type CampaignTargetRow,
  computeCampaignTarget,
  toCampaignDto,
} from './rules/campaign-rules'
import {planCampaignParts} from './rules/campaign-schedule-rules'
import {
  invitationOverviewOf,
  invitationStatesOf,
  launchCountsOf,
  launchPredicate,
  launchSubmissionIdOf,
  reminderCountsOf,
  reminderPredicateOf,
} from './rules/member-invitation-campaign-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  getCampaignDailySendCap,
  getCampaignNature,
  getInvitationLetterText,
  getInvitationLinkDays,
  getInvitationText,
  type ResolvedAssociationSettings,
} from './types/domain/association-settings-types'
import {
  type CampaignDTO,
  MEMBER_INVITATION_LAUNCH_SEND_KIND,
  MEMBER_INVITATION_REMINDER_SEND_KIND,
  type MemberInvitationSendKind,
} from './types/domain/campaign-types'
import {effectiveAuthor} from './types/domain/impersonation-types'
import type {
  LaunchMemberInvitationsInput,
  LaunchMemberInvitationsResult,
  MemberInvitationRefusal,
  MemberInvitationSendingDTO,
  MemberInvitationsPageDTO,
  MemberInvitationsPageInput,
  RemindNeverSignedInInput,
  RemindNeverSignedInResult,
} from './types/domain/member-invitation-campaign-types'
import {calendarDayOf} from './types/domain/water-analysis-types'
import {
  launchMemberInvitationsServiceSchema,
  memberInvitationsPageServiceSchema,
  remindNeverSignedInServiceSchema,
} from './validation/member-invitation-campaign-validation'

/**
 * Lancement des invitations, relance des jamais connectes et suivi
 * d'adoption (s42b, ADR 072). Le lancement et la relance sont des campagnes,
 * creees par le coeur partage `createCampaignInTenant` ; leur lien de
 * connexion nait a la livraison de chaque destinataire, jamais ici. Ni
 * adresse ni lien dans un journal : l'intercepteur ne logge aucun detail.
 */

const INVITATIONS_DENIED =
  "Seul le bureau de l'association peut inviter les membres"
const ASSOCIATION_NOT_FOUND = 'Association introuvable'

const INVITATION_KINDS: readonly MemberInvitationSendKind[] = [
  MEMBER_INVITATION_LAUNCH_SEND_KIND,
  MEMBER_INVITATION_REMINDER_SEND_KIND,
]

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
    throw new AuthorizationError(INVITATIONS_DENIED)
  }
  return authUser
}

/** L'auteur effectif, lu avant tout scope de tenant (s48). */
const readAuthor = async (organizationId: string) => {
  const authUser = await requireCampaignManager(organizationId)
  return effectiveAuthor(authUser, (await getActingContext())?.impersonator)
}

/**
 * Le contenu fige de l'invitation de masse (ADR 072 §6) : objet et
 * pre-en-tete sans le nom de l'association (le gabarit de campagne le pose),
 * texte de l'invitation du reglage ou par defaut, resolu a la creation.
 */
const frozenEmailContentOf = (settings: ResolvedAssociationSettings) => {
  const tCampaign = createTranslator({
    locale: PRODUCT_LOCALE,
    messages: fr,
    namespace: 'email.campaign.memberInvitation',
  })
  const tInvitation = createTranslator({
    locale: PRODUCT_LOCALE,
    messages: fr,
    namespace: 'email.user.invitation',
  })
  return {
    subject: tCampaign('subject'),
    preheader: tCampaign('preheader'),
    bodyMarkdown: getInvitationText(settings) ?? tInvitation('defaultText'),
  }
}

/** Le texte du courrier de lancement, du reglage ou par defaut. */
const frozenLetterTextOf = (settings: ResolvedAssociationSettings): string =>
  getInvitationLetterText(settings) ??
  createTranslator({
    locale: PRODUCT_LOCALE,
    messages: fr,
    namespace: 'CampaignsBureau.letters.pdf.memberInvitation',
  })('defaultText')

/**
 * Les refus communs, avant toute creation : envois aux membres coupes, puis
 * association sans adresse de site (aucun lien ne pourrait naitre).
 */
const refusalOf = async (
  organizationId: string
): Promise<
  | {refusal: MemberInvitationRefusal}
  | {refusal: null; settings: ResolvedAssociationSettings}
> => {
  if (!(await isClientEmailEnabledService())) {
    return {refusal: {status: 'delivery_disabled'}}
  }
  const [organization, settings] = await Promise.all([
    getOrganizationByIdDao(organizationId),
    getAssociationSettingsService(organizationId),
  ])
  if (!organization) throw new NotFoundError(ASSOCIATION_NOT_FOUND)
  if (!associationOriginOf(organization.domain)) {
    return {refusal: {status: 'no_site_address'}}
  }
  return {refusal: null, settings}
}

type InvitationSendings = {
  launch: MemberInvitationSendingDTO | null
  reminders: MemberInvitationSendingDTO[]
  submissionIds: Map<string, string>
}

const isInProgress = (campaign: CampaignDTO): boolean =>
  campaign.parts.some(
    (part) =>
      part.displayState === 'scheduled' || part.displayState === 'sending'
  )

/** Le lancement et les relances de l'association. A appeler sous `withTenant`. */
const readInvitationSendings = async (
  organizationId: string
): Promise<InvitationSendings> => {
  const rows = await getCampaignsByTemplateIdsDao(
    organizationId,
    INVITATION_KINDS
  )
  const ids = rows.map((row) => row.id)
  const [parts, counts] = await Promise.all([
    getCampaignPartsDao(ids),
    getRecipientStatusCountsDao(ids),
  ])
  const sendings = rows.map((row) => {
    const campaign = toCampaignDto(row, parts, counts)
    return {campaign, inProgress: isInProgress(campaign)}
  })
  return {
    launch:
      sendings.find(
        (sending) =>
          sending.campaign.templateId === MEMBER_INVITATION_LAUNCH_SEND_KIND
      ) ?? null,
    reminders: sendings.filter(
      (sending) =>
        sending.campaign.templateId === MEMBER_INVITATION_REMINDER_SEND_KIND
    ),
    submissionIds: new Map(rows.map((row) => [row.submissionId, row.id])),
  }
}

const emailsOf = (rows: readonly {email: string | null}[]): string[] =>
  rows.flatMap((row) => (row.email ? [row.email] : []))

/** Les traces des adresses de la cible. A appeler sous `withTenant`. */
const readStates = async (
  organizationId: string,
  rows: readonly {email: string | null}[]
) =>
  invitationStatesOf(
    await getInvitationStatesByEmailsDao(organizationId, emailsOf(rows))
  )

/** La cible d'un envoi d'invitation, lue sous le tenant de la creation. */
const invitationTargetOf =
  (
    organizationId: string,
    settings: ResolvedAssociationSettings,
    kind: MemberInvitationSendKind
  ) =>
  async (): Promise<CampaignTargetReading> => {
    const nature = getCampaignNature(settings, kind)
    const rows = await getCampaignTargetRowsDao(organizationId)
    const isTargeted: CampaignTargetPredicate =
      kind === MEMBER_INVITATION_LAUNCH_SEND_KIND
        ? launchPredicate
        : reminderPredicateOf(await readStates(organizationId, rows))
    return {
      rows,
      target: computeCampaignTarget(rows, isTargeted, nature),
      isTargeted,
      group: null,
      nature,
    }
  }

const deliveryOf = (organizationId: string, created: boolean) =>
  created ? () => runImmediateCampaignPass(organizationId) : null

/**
 * Le lancement (criteres 1, 2, 5, 6) : un seul par association (Q7). Ordre :
 * validation -> autorisation -> auteur -> refus (envois coupes, pas de site)
 * -> lancement existant -> creation. Le contenu est fige : texte de
 * l'invitation dans `body_markdown`, texte du courrier dans `letter_text`.
 */
export const launchMemberInvitationsService = async (
  input: LaunchMemberInvitationsInput
): Promise<LaunchMemberInvitationsResult> => {
  const data = parseOrThrow(launchMemberInvitationsServiceSchema, input)
  const author = await readAuthor(data.organizationId)
  const checked = await refusalOf(data.organizationId)
  if (checked.refusal) return checked.refusal

  const submissionId = launchSubmissionIdOf(data.organizationId)
  const {launch} = await withTenant(data.organizationId, () =>
    readInvitationSendings(data.organizationId)
  )
  if (launch) {
    return {
      status: 'already_launched',
      campaignId: launch.campaign.id,
      sendDate: launch.campaign.sendDate,
      authorName: launch.campaign.authorName,
    }
  }

  const created = await createCampaignInTenant({
    organizationId: data.organizationId,
    dailySendCap: getCampaignDailySendCap(checked.settings),
    now: new Date(),
    readTarget: invitationTargetOf(
      data.organizationId,
      checked.settings,
      MEMBER_INVITATION_LAUNCH_SEND_KIND
    ),
    content: {
      submissionId,
      ...frozenEmailContentOf(checked.settings),
      letterText: frozenLetterTextOf(checked.settings),
      templateId: MEMBER_INVITATION_LAUNCH_SEND_KIND,
      targetKind: 'all_members',
      ...author,
    },
    acceptsLettersOnly: true,
  })
  if (created.status !== 'created') return {status: 'nobody'}
  return {
    status: 'created',
    campaignId: created.campaignId,
    deliver: deliveryOf(data.organizationId, created.created),
  }
}

/**
 * La relance des adresses actives jamais connectees (critere 8), par email
 * seul (Q10). Refusee avant le lancement, et tant qu'une part du lancement ou
 * d'une relance reste a envoyer : deux liens ne concourent jamais.
 */
export const remindNeverSignedInService = async (
  input: RemindNeverSignedInInput
): Promise<RemindNeverSignedInResult> => {
  const data = parseOrThrow(remindNeverSignedInServiceSchema, input)
  const author = await readAuthor(data.organizationId)
  const checked = await refusalOf(data.organizationId)
  if (checked.refusal) return checked.refusal

  const sendings = await withTenant(data.organizationId, () =>
    readInvitationSendings(data.organizationId)
  )
  if (!sendings.launch) return {status: 'not_launched'}
  const replayed = sendings.submissionIds.get(data.submissionId)
  if (replayed) return {status: 'created', campaignId: replayed, deliver: null}
  if ([sendings.launch, ...sendings.reminders].some((s) => s.inProgress)) {
    return {status: 'in_progress'}
  }

  const created = await createCampaignInTenant({
    organizationId: data.organizationId,
    dailySendCap: getCampaignDailySendCap(checked.settings),
    now: new Date(),
    readTarget: invitationTargetOf(
      data.organizationId,
      checked.settings,
      MEMBER_INVITATION_REMINDER_SEND_KIND
    ),
    content: {
      submissionId: data.submissionId,
      ...frozenEmailContentOf(checked.settings),
      templateId: MEMBER_INVITATION_REMINDER_SEND_KIND,
      targetKind: 'all_members',
      ...author,
    },
  })
  if (created.status !== 'created') return {status: 'nobody'}
  return {
    status: 'created',
    campaignId: created.campaignId,
    deliver: deliveryOf(data.organizationId, created.created),
  }
}

/**
 * La page « Invitations des membres » (ecrans 1 et 2) : le lancement et ses
 * relances, les decomptes avant envoi, le plan previsionnel (lecture, sans
 * verrou) et le suivi d'adoption. Donnee par utilisateur, jamais cachee.
 */
export const getMemberInvitationsOverviewService = async (
  input: MemberInvitationsPageInput
): Promise<MemberInvitationsPageDTO> => {
  const data = parseOrThrow(memberInvitationsPageServiceSchema, input)
  await requireCampaignManager(data.organizationId)
  const settings = await getAssociationSettingsService(data.organizationId)
  const now = new Date()
  const today = calendarDayOf(now)

  return withTenant(data.organizationId, async () => {
    const sendings = await readInvitationSendings(data.organizationId)
    const rows: CampaignTargetRow[] = await getCampaignTargetRowsDao(
      data.organizationId
    )
    const addresses = await getInvitationAddressesDao(data.organizationId)
    const states = await readStates(data.organizationId, [
      ...rows,
      ...addresses,
    ])
    const allotted = await getAllottedRecipientsByDayDao(
      data.organizationId,
      today
    )

    const launchCounts = launchCountsOf({
      rows,
      nature: getCampaignNature(settings, MEMBER_INVITATION_LAUNCH_SEND_KIND),
      addresses,
      now,
    })
    const reminderCounts = reminderCountsOf({
      rows,
      states,
      nature: getCampaignNature(settings, MEMBER_INVITATION_REMINDER_SEND_KIND),
      addresses,
      now,
    })
    const dailySendCap = getCampaignDailySendCap(settings)
    const upcoming = sendings.launch
      ? reminderCounts.recipients
      : launchCounts.recipients

    return {
      launch: sendings.launch,
      reminders: sendings.reminders,
      launchCounts,
      reminderCounts,
      plan: {
        today,
        dailySendCap,
        allottedToday: allotted[today] ?? 0,
        parts: planCampaignParts(upcoming, dailySendCap, allotted, today),
      },
      linkDays: getInvitationLinkDays(settings),
      overview: invitationOverviewOf({
        addresses,
        states,
        rows,
        nature: sendings.launch?.campaign.nature ?? launchCounts.nature,
        now,
        page: data.page,
      }),
    }
  })
}
