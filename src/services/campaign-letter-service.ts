import 'server-only'

import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

import {
  type CampaignTargetRowModel,
  getCampaignByIdDao,
  getCampaignLetterProfileIdsDao,
  getCampaignTargetRowsDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {PRODUCT_LOCALE} from '@/lib/helper/locale-helper'
import {letterAddressFitsWindow} from '@/lib/letters/letter-address-measure.server'
import {renderCalibrationPdf} from '@/lib/letters/render-calibration-pdf'
import {renderLettersPdf} from '@/lib/letters/render-letters-pdf'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {
  homonymGroupsOf,
  letterAddressLinesOf,
  type LetterProfile,
  lettersOf,
} from './rules/campaign-letter-rules'
import {formatCampaignDate} from './rules/campaign-rules'
import {substituteInvoicesList} from './rules/unpaid-reminder-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
  ASSOCIATION_LEGAL_NAME_SETTING_KEY,
  getLetterAddressOffset,
  type ResolvedAssociationSettings,
} from './types/domain/association-settings-types'
import type {
  CampaignLetterContextDTO,
  CampaignLetterContextResult,
  CampaignLetterGrouping,
  CampaignLetterProfileRefDTO,
  CampaignLettersPdfResult,
  CampaignLetterUnavailableStatus,
} from './types/domain/campaign-types'
import {UNPAID_REMINDER_SEND_KIND} from './types/domain/campaign-types'
import {
  readReminderInvoices,
  type ReminderInvoicesOf,
} from './unpaid-reminder-invoices'
import {campaignLetterGroupingSchema} from './validation/campaign-validation'

/**
 * Le courrier postal d'une campagne (s28, ADR 065 a 067) : les fiches sans
 * adresse email **figees a la creation**, relues a la generation (adresse et
 * parcelles actuelles), mises en lettres puis en un seul PDF, jamais stocke.
 * Chaque fonction : validation, `campaign.manage`, puis `withTenant`. Noms et
 * domiciles sont des donnees personnelles : jamais dans un journal.
 */

const LETTERS_DENIED =
  "Seul le bureau de l'association peut preparer le courrier postal"
const ASSOCIATION_NOT_FOUND = 'Association introuvable'
const PDF_NAMESPACE = 'CampaignsBureau.letters.pdf'

const idsSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
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
    throw new AuthorizationError(LETTERS_DENIED)
  }
}

type LetterProfileRow = LetterProfile & {currentParcelNumbers: string[]}

/** Une fiche par identifiant : la cible rend une ligne par adresse active. */
const letterProfilesOf = (
  rows: readonly CampaignTargetRowModel[],
  frozenIds: readonly string[]
): LetterProfileRow[] => {
  const frozen = new Set(frozenIds)
  const byId = new Map<string, LetterProfileRow>()
  for (const row of rows) {
    if (!frozen.has(row.memberProfileId) || byId.has(row.memberProfileId)) {
      continue
    }
    byId.set(row.memberProfileId, {
      id: row.memberProfileId,
      name: row.name,
      companyName: row.companyName,
      homeAddressLine: row.homeAddressLine,
      homeAddressComplement: row.homeAddressComplement,
      homePostalCode: row.homePostalCode,
      homeCity: row.homeCity,
      landAddressLine: row.landAddressLine,
      landAddressComplement: row.landAddressComplement,
      landPostalCode: row.landPostalCode,
      landCity: row.landCity,
      currentParcelNumbers: row.currentParcelNumbers,
    })
  }
  return [...byId.values()]
}

type FrozenLetters =
  | {status: CampaignLetterUnavailableStatus}
  | {
      status: 'ready'
      campaignId: string
      templateId: string | null
      sendDate: string
      subject: string
      bodyMarkdown: string
      profiles: LetterProfileRow[]
    }

/**
 * La campagne et ses fiches figees, sous le tenant. Une campagne d'une autre
 * association est introuvable avant toute lecture de fiche ; sans ligne
 * figee, elle precede s28 (des sans-email comptes) ou n'en a aucun.
 */
const readFrozenLetters = (
  organizationId: string,
  campaignId: string
): Promise<FrozenLetters> =>
  withTenant(organizationId, async () => {
    const campaign = await getCampaignByIdDao(organizationId, campaignId)
    if (!campaign) return {status: 'not_found'}
    const ids = await getCampaignLetterProfileIdsDao(organizationId, campaignId)
    if (ids.length === 0) {
      return {status: campaign.withoutEmailCount > 0 ? 'legacy' : 'none'}
    }
    const profiles = letterProfilesOf(
      await getCampaignTargetRowsDao(organizationId),
      ids
    )
    if (profiles.length === 0) return {status: 'none'}
    return {
      status: 'ready',
      campaignId: campaign.id,
      templateId: campaign.templateId,
      sendDate: campaign.sendDate,
      subject: campaign.subject,
      bodyMarkdown: campaign.bodyMarkdown,
      profiles,
    }
  })

type ReadyLetters = Extract<FrozenLetters, {status: 'ready'}>

/**
 * Les lettres d'une relance d'impaye (s29, ADR 070 §9) : les factures des
 * fiches figees sont relues a la generation ; une fiche sans impaye de
 * l'echeance est retiree. Une autre campagne est rendue telle quelle.
 */
const withReminderInvoices = async (
  organizationId: string,
  frozen: FrozenLetters
): Promise<
  | {status: CampaignLetterUnavailableStatus}
  | (ReadyLetters & {invoicesOf: ReminderInvoicesOf | null})
> => {
  if (frozen.status !== 'ready') return frozen
  if (frozen.templateId !== UNPAID_REMINDER_SEND_KIND) {
    return {...frozen, invoicesOf: null}
  }
  const invoicesOf = await readReminderInvoices(
    organizationId,
    {id: frozen.campaignId, templateId: frozen.templateId},
    await getAssociationSettingsService(organizationId),
    frozen.profiles.map((profile) => profile.id)
  )
  if (!invoicesOf) return {...frozen, invoicesOf: null}
  const profiles = frozen.profiles.filter(
    (profile) => invoicesOf([profile.id]) !== null
  )
  if (profiles.length === 0) return {status: 'none'}
  return {...frozen, profiles, invoicesOf}
}

const byNumber = (a: string, b: string) =>
  a.localeCompare(b, 'fr', {numeric: true})

const refOf = (profile: LetterProfileRow): CampaignLetterProfileRefDTO => ({
  id: profile.id,
  name: profile.name,
  parcelNumbers: [...profile.currentParcelNumbers].sort(byNumber),
})

const homeAddressOf = (profile: LetterProfile): string =>
  [
    profile.homeAddressLine?.trim(),
    [profile.homePostalCode?.trim(), profile.homeCity?.trim()]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(', ')

const letterContextOf = (
  sendDate: string,
  profiles: readonly LetterProfileRow[]
): CampaignLetterContextDTO => {
  const sourceOf = (profile: LetterProfileRow) =>
    letterAddressLinesOf(profile).source
  const landAddressed = profiles.filter((p) => sourceOf(p) === 'land')
  const nameOnly = profiles.filter((p) => sourceOf(p) === 'name_only')
  const addressTooWide = profiles.filter(
    (p) => !letterAddressFitsWindow(letterAddressLinesOf(p).lines)
  )
  return {
    sendDate,
    withoutEmailCount: profiles.length,
    withoutHomeCount: landAddressed.length + nameOnly.length,
    homonymGroups: homonymGroupsOf(profiles).map((group) => ({
      name: group[0].name,
      homeAddress: homeAddressOf(group[0]),
      profileCount: group.length,
      parcelNumbers: group
        .flatMap((profile) => profile.currentParcelNumbers)
        .sort(byNumber),
    })),
    landAddressed: landAddressed.map(refOf),
    nameOnly: nameOnly.map(refOf),
    addressTooWide: addressTooWide.map(refOf),
  }
}

/**
 * La carte « Courrier postal » d'une campagne (s28) : decomptes, homonymes a
 * signaler (critere 2), lettres au terrain ou au nom seul (ADR 067 §1), et
 * adresses trop larges pour le cadre de la fenetre (§6.1).
 */
export const getCampaignLetterContextService = async (
  organizationId: string,
  campaignId: string
): Promise<CampaignLetterContextResult> => {
  const ids = parseOrThrow(idsSchema, {organizationId, campaignId})
  await requireCampaignManager(ids.organizationId)

  const frozen = await withReminderInvoices(
    ids.organizationId,
    await readFrozenLetters(ids.organizationId, ids.campaignId)
  )
  if (frozen.status !== 'ready') return {status: frozen.status}
  return {
    status: 'ready',
    context: letterContextOf(frozen.sendDate, frozen.profiles),
  }
}

type LetterAssociation = {
  name: string
  legalMentions: string | null
  settings: ResolvedAssociationSettings
}

const textSettingOf = (
  settings: ResolvedAssociationSettings,
  key: string
): string | null => {
  const value = settings[key]?.value
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

const readLetterAssociation = async (
  organizationId: string
): Promise<LetterAssociation> => {
  const [settings, organization] = await Promise.all([
    getAssociationSettingsService(organizationId),
    getOrganizationByIdDao(organizationId),
  ])
  if (!organization) throw new NotFoundError(ASSOCIATION_NOT_FOUND)
  const mentions = [
    textSettingOf(settings, ASSOCIATION_LEGAL_NAME_SETTING_KEY),
    textSettingOf(settings, ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY),
  ].filter((text): text is string => text !== null)
  return {
    name: organization.name,
    legalMentions: mentions.length > 0 ? mentions.join(' · ') : null,
    settings,
  }
}

/**
 * Le PDF du courrier (criteres 1 a 4) : une lettre par fiche figee, ou par
 * personne si le bureau regroupe les homonymes ; sans choix alors qu'il en
 * existe, rien n'est produit. Contenu fige de la campagne, date d'envoi,
 * adresses et parcelles actuelles.
 */
export const generateCampaignLettersService = async (
  organizationId: string,
  campaignId: string,
  grouping: CampaignLetterGrouping | null
): Promise<CampaignLettersPdfResult> => {
  const ids = parseOrThrow(idsSchema, {organizationId, campaignId})
  const choice = parseOrThrow(campaignLetterGroupingSchema, grouping)
  await requireCampaignManager(ids.organizationId)

  const frozen = await withReminderInvoices(
    ids.organizationId,
    await readFrozenLetters(ids.organizationId, ids.campaignId)
  )
  if (frozen.status !== 'ready') return {status: frozen.status}
  const hasHomonyms = homonymGroupsOf(frozen.profiles).length > 0
  if (hasHomonyms && !choice) return {status: 'grouping_required'}

  const parcels = Object.fromEntries(
    frozen.profiles.map((profile) => [profile.id, profile.currentParcelNumbers])
  )
  const invoicesOf = frozen.invoicesOf
  const letters = lettersOf(frozen.profiles, choice ?? 'per_land', parcels).map(
    (letter) =>
      invoicesOf
        ? {
            ...letter,
            bodyMarkdown: substituteInvoicesList(
              frozen.bodyMarkdown,
              invoicesOf(letter.memberProfileIds) ?? ''
            ),
          }
        : letter
  )
  const association = await readLetterAssociation(ids.organizationId)
  const t = await getTranslations({
    locale: PRODUCT_LOCALE,
    namespace: PDF_NAMESPACE,
  })
  const rendered = await renderLettersPdf({
    association: {
      name: association.name,
      legalMentions: association.legalMentions,
    },
    subject: frozen.subject,
    bodyMarkdown: frozen.bodyMarkdown,
    sendDate: frozen.sendDate,
    letters,
    offset: getLetterAddressOffset(association.settings),
    texts: {
      subjectLabel: t('subjectLabel'),
      dateLine: t('dateLine', {date: formatCampaignDate(frozen.sendDate)}),
      footer: t('footer'),
      continuation: (values) => t('continuation', values),
    },
  })
  return {
    status: 'ready',
    pdf: rendered.pdf,
    sendDate: frozen.sendDate,
    letterCount: letters.length,
    pageCount: rendered.pageCount,
  }
}

/**
 * La page de calage de l'association (ADR 067 §4) : la fenetre, le cadre
 * decale de ses reglages, une adresse d'exemple et le decalage ecrit.
 */
export const getLetterCalibrationPdfService = async (
  organizationId: string
): Promise<Uint8Array> => {
  const orgId = parseOrThrow(z.string().uuid(), organizationId)
  await requireCampaignManager(orgId)

  const offset = getLetterAddressOffset(
    await getAssociationSettingsService(orgId)
  )
  const t = await getTranslations({
    locale: PRODUCT_LOCALE,
    namespace: PDF_NAMESPACE,
  })
  return renderCalibrationPdf({
    offset,
    texts: {
      sampleLines: [t('sampleName'), t('sampleAddress'), t('sampleLocality')],
      instruction: t('calibrationInstruction', {
        x: offset.xMm,
        y: offset.yMm,
      }),
    },
  })
}
