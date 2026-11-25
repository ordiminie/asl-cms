import 'server-only'

import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

import {DocumentTemplateModel} from '@/db/models/document-template-model'
import {getCampaignTargetRowsDao} from '@/db/repositories/campaign-repository'
import {
  createDocumentTemplateDao,
  deleteDocumentTemplateDao,
  getDocumentTemplateByIdDao,
  listDocumentTemplatesDao,
  updateDocumentTemplateDao,
} from '@/db/repositories/document-template-repository'
import {
  getCurrentParcelNumbersByProfileDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {
  getRecipientGroupByIdDao,
  getRecipientGroupMemberIdsDao,
  listRecipientGroupsDao,
} from '@/db/repositories/recipient-group-repository'
import {withTenant} from '@/db/tenant-scope'
import {PRODUCT_LOCALE} from '@/lib/helper/locale-helper'
import {renderLettersPdf} from '@/lib/letters/render-letters-pdf'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {resolveMemberBillingProvider} from './billing/resolve-member-billing-provider'
import {readLetterAssociation} from './campaign-letter-service'
import {AuthorizationError} from './errors/authorization-error'
import {CampaignTargetUnavailableError} from './errors/campaign-errors'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {depositMemberDocumentService} from './member-document-service'
import {letterAddressLinesOf, lettersOf} from './rules/campaign-letter-rules'
import {formatCampaignDate} from './rules/campaign-rules'
import {
  uniqueProfilesOf,
  unknownTemplateVariablesOf,
  usedTemplateVariablesOf,
} from './rules/document-template-rules'
import {
  getInvoiceStatusClassification,
  unpaidProfileIdsOf,
} from './rules/member-invoice-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {getLetterAddressOffset} from './types/domain/association-settings-types'
import {
  DOCUMENT_TEMPLATE_BODY_MAX_LENGTH,
  DOCUMENT_TEMPLATE_NAME_MAX_LENGTH,
  DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH,
  DocumentLotReachDTO,
  DocumentLotTarget,
  DocumentRecipientDTO,
  DocumentTemplateDepositResult,
  DocumentTemplateDTO,
  DocumentTemplateFieldIssue,
  DocumentTemplateFields,
  documentTemplateFileNameOf,
  DocumentTemplateIssues,
  DocumentTemplateListItemDTO,
  DocumentTemplateRenderResult,
  DocumentTemplateSaveResult,
} from './types/domain/document-template-types'
import {RecipientGroupDTO} from './types/domain/recipient-group-types'
import {campaignTargetSchema} from './validation/campaign-validation'
import {
  createDocumentTemplateServiceSchema,
  depositTemplateDocumentServiceSchema,
  documentRecipientServiceSchema,
  documentTemplateOrganizationIdSchema,
  documentTemplateScopeServiceSchema,
  renderTemplateDocumentServiceSchema,
  updateDocumentTemplateServiceSchema,
} from './validation/document-template-validation'
import {newsDateSchema} from './validation/news-validation'

/**
 * Modeles de documents du bureau (s36, ADR 074). Chaque fonction valide
 * l'entree, puis exige `document.template.manage` sur l'association, puis
 * s'execute sous `withTenant` : un modele d'une autre association est
 * invisible. Un document produit est nominatif : jamais dans un journal
 * (intercepteur sans details).
 */

const TEMPLATES_DENIED =
  "Seul le bureau de l'association peut gérer les modèles de documents"
const TEMPLATE_NOT_FOUND = 'Modèle de document introuvable'
const GROUP_NOT_FOUND = 'Groupe introuvable'
const DEPOSIT_DENIED =
  "Seul le bureau de l'association peut déposer un document nominatif"
const PDF_NAMESPACE = 'DocumentTemplatesBureau.pdf'

const parseOrThrow = <S extends z.ZodType>(
  schema: S,
  input: unknown
): z.output<S> => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

const requireTemplatesManager = async (
  organizationId: string
): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.DOCUMENT_TEMPLATE_MANAGE
    )
  ) {
    throw new AuthorizationError(TEMPLATES_DENIED)
  }
}

/** Tout depot exige en plus l'action de s32, verifiee d'emblee (ADR 074 §6). */
const requireDocumentDepositor = async (
  organizationId: string
): Promise<void> => {
  await requireTemplatesManager(organizationId)
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_DOCUMENT_MANAGE
    )
  ) {
    throw new AuthorizationError(DEPOSIT_DENIED)
  }
}

const toDto = (row: DocumentTemplateModel): DocumentTemplateDTO => ({
  id: row.id,
  name: row.name,
  subject: row.subject,
  bodyMarkdown: row.bodyMarkdown,
  updatedAt: row.updatedAt,
})

const lengthIssueOf = (
  value: string,
  max: number
): DocumentTemplateFieldIssue | undefined => {
  if (value === '') return {code: 'missing'}
  if (value.length > max) return {code: 'tooLong', max}
  return undefined
}

const variablesIssueOf = (
  variables: string[]
): DocumentTemplateFieldIssue | undefined =>
  variables.length > 0 ? {code: 'unknownVariables', variables} : undefined

/**
 * Les refus de champ d'un modele (critere 4) : nom, objet, texte — vide, trop
 * long, puis variables inconnues. Aucun refus → objet vide.
 */
const issuesOf = (fields: DocumentTemplateFields): DocumentTemplateIssues => {
  const unknown = unknownTemplateVariablesOf(fields)
  const candidates: DocumentTemplateIssues = {
    name: lengthIssueOf(fields.name, DOCUMENT_TEMPLATE_NAME_MAX_LENGTH),
    subject:
      lengthIssueOf(fields.subject, DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH) ??
      variablesIssueOf(unknown.subject),
    bodyMarkdown:
      lengthIssueOf(fields.bodyMarkdown, DOCUMENT_TEMPLATE_BODY_MAX_LENGTH) ??
      variablesIssueOf(unknown.bodyMarkdown),
  }
  return Object.fromEntries(
    Object.entries(candidates).filter(([, issue]) => issue !== undefined)
  )
}

const fieldsOf = ({
  name,
  subject,
  bodyMarkdown,
}: DocumentTemplateFields): DocumentTemplateFields => ({
  name,
  subject,
  bodyMarkdown,
})

/** Le compte connecte gere-t-il les modeles de cette association ? */
export const canManageDocumentTemplatesService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = documentTemplateOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false
  return canPerformAction(
    await getAuthUser(),
    parsed.data,
    ActionIdConst.DOCUMENT_TEMPLATE_MANAGE
  )
}

/** Les modeles de l'association, par nom, avec les variables employees. */
export const listDocumentTemplatesService = async (
  organizationId: string
): Promise<DocumentTemplateListItemDTO[]> => {
  const orgId = parseOrThrow(
    documentTemplateOrganizationIdSchema,
    organizationId
  )
  await requireTemplatesManager(orgId)
  const rows = await withTenant(orgId, () => listDocumentTemplatesDao(orgId))
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    variables: usedTemplateVariablesOf(row),
    updatedAt: row.updatedAt,
  }))
}

/** Un modele du tenant ; `undefined` s'il est introuvable sous le tenant. */
export const getDocumentTemplateService = async (input: {
  organizationId: string
  templateId: string
}): Promise<DocumentTemplateDTO | undefined> => {
  const data = parseOrThrow(documentTemplateScopeServiceSchema, input)
  await requireTemplatesManager(data.organizationId)
  const row = await withTenant(data.organizationId, () =>
    getDocumentTemplateByIdDao(data.templateId)
  )
  return row ? toDto(row) : undefined
}

/**
 * Cree un modele (critere 1). Ordre : `safeParse` -> action -> nom, objet,
 * texte (critere 4) **avant toute ecriture** -> ecriture sous le tenant.
 */
export const createDocumentTemplateService = async (
  input: DocumentTemplateFields & {organizationId: string}
): Promise<DocumentTemplateSaveResult> => {
  const data = parseOrThrow(createDocumentTemplateServiceSchema, input)
  await requireTemplatesManager(data.organizationId)

  const issues = issuesOf(data)
  if (Object.keys(issues).length > 0) return {status: 'rejected', issues}

  const row = await withTenant(data.organizationId, () =>
    createDocumentTemplateDao({
      organizationId: data.organizationId,
      ...fieldsOf(data),
    })
  )
  return {status: 'saved', template: toDto(row)}
}

/** Modifie un modele ; introuvable sous le tenant → `NotFoundError`. */
export const updateDocumentTemplateService = async (
  input: DocumentTemplateFields & {organizationId: string; templateId: string}
): Promise<DocumentTemplateSaveResult> => {
  const data = parseOrThrow(updateDocumentTemplateServiceSchema, input)
  await requireTemplatesManager(data.organizationId)

  const issues = issuesOf(data)
  if (Object.keys(issues).length > 0) return {status: 'rejected', issues}

  const row = await withTenant(data.organizationId, () =>
    updateDocumentTemplateDao(data.templateId, fieldsOf(data))
  )
  if (!row) throw new NotFoundError(TEMPLATE_NOT_FOUND)
  return {status: 'saved', template: toDto(row)}
}

/**
 * Supprime un modele ; les documents deja deposes restent figes. Introuvable
 * sous le tenant → `NotFoundError`.
 */
export const deleteDocumentTemplateService = async (input: {
  organizationId: string
  templateId: string
}): Promise<{name: string}> => {
  const data = parseOrThrow(documentTemplateScopeServiceSchema, input)
  await requireTemplatesManager(data.organizationId)

  const row = await withTenant(data.organizationId, () =>
    deleteDocumentTemplateDao(data.templateId)
  )
  if (!row) throw new NotFoundError(TEMPLATE_NOT_FOUND)
  return {name: row.name}
}

type RenderTarget = {
  organizationId: string
  templateId: string
  memberProfileId: string
  documentDate: string
}

/** Le modele, la fiche et ses parcelles actuelles, lus sous le tenant. */
const readRenderSources = (target: RenderTarget) =>
  withTenant(target.organizationId, async () => {
    const [template, profile, parcels] = await Promise.all([
      getDocumentTemplateByIdDao(target.templateId),
      getMemberProfileByIdDao(target.memberProfileId),
      getCurrentParcelNumbersByProfileDao([target.memberProfileId]),
    ])
    return {template, profile, parcels}
  })

/**
 * Le document d'une fiche depuis un modele, en memoire (criteres 2 et 4) :
 * la lettre du moteur de s28, `{date}` = la date choisie, `{association}` =
 * le nom affiche. Un modele qui contiendrait une variable inconnue n'est pas
 * rendu (defense du critere 4).
 */
const renderTemplateDocument = async (
  target: RenderTarget
): Promise<DocumentTemplateRenderResult> => {
  const {template, profile, parcels} = await readRenderSources(target)
  if (!template || !profile) return {status: 'not_found'}

  const unknown = unknownTemplateVariablesOf(template)
  const variables = [...new Set([...unknown.subject, ...unknown.bodyMarkdown])]
  if (variables.length > 0) return {status: 'unknown_variables', variables}

  const [letter] = lettersOf([profile], 'per_land', parcels)
  const association = await readLetterAssociation(target.organizationId)
  const t = await getTranslations({
    locale: PRODUCT_LOCALE,
    namespace: PDF_NAMESPACE,
  })
  try {
    const rendered = await renderLettersPdf({
      association: {
        name: association.name,
        legalMentions: association.legalMentions,
      },
      subject: template.subject,
      bodyMarkdown: template.bodyMarkdown,
      sendDate: target.documentDate,
      letters: [letter],
      offset: getLetterAddressOffset(association.settings),
      extraValues: {association: association.name},
      texts: {
        subjectLabel: t('subjectLabel'),
        dateLine: t('dateLine', {
          date: formatCampaignDate(target.documentDate),
        }),
        footer: t('footer'),
        continuation: (values) => t('continuation', values),
      },
    })
    return {
      status: 'ready',
      pdf: rendered.pdf,
      fileName: documentTemplateFileNameOf(target.documentDate),
    }
  } catch (error) {
    logger.error('[DOCUMENT-TEMPLATE] Le PDF n’a pas pu être produit', {
      templateId: target.templateId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return {status: 'render_failed'}
  }
}

const isValidDocumentDate = (documentDate: string): boolean =>
  newsDateSchema.safeParse(documentDate).success

/**
 * Le document d'une fiche, a telecharger (critere 2) : produit en memoire,
 * **rien n'est stocke** (ADR 066 §5, ADR 074 §4).
 */
export const renderTemplateDocumentService = async (input: {
  organizationId: string
  templateId: string
  memberProfileId: string
  documentDate: string
}): Promise<DocumentTemplateRenderResult> => {
  const data = parseOrThrow(renderTemplateDocumentServiceSchema, input)
  await requireTemplatesManager(data.organizationId)
  if (!isValidDocumentDate(data.documentDate)) return {status: 'invalid_date'}
  return renderTemplateDocument(data)
}

/**
 * Le document d'une fiche, depose dans son dossier nominatif (criteres 2 et
 * 3) : les deux actions d'emblee, puis le rendu, puis le depot par s32 —
 * jamais le stockage de s32 directement. Une ligne de lot est un appel.
 */
export const depositTemplateDocumentService = async (input: {
  organizationId: string
  templateId: string
  memberProfileId: string
  documentDate: string
  categoryId: string
  title: string
}): Promise<DocumentTemplateDepositResult> => {
  const data = parseOrThrow(depositTemplateDocumentServiceSchema, input)
  await requireDocumentDepositor(data.organizationId)
  if (!isValidDocumentDate(data.documentDate)) return {status: 'invalid_date'}

  const rendered = await renderTemplateDocument(data)
  if (rendered.status !== 'ready') return rendered

  return depositMemberDocumentService({
    organizationId: data.organizationId,
    memberProfileId: data.memberProfileId,
    title: data.title,
    categoryId: data.categoryId,
    documentDate: data.documentDate,
    file: new File([rendered.pdf as BlobPart], rendered.fileName, {
      type: 'application/pdf',
    }),
  })
}

type LotProfileRow = {
  memberProfileId: string
  name: string
  currentParcelNumbers: readonly string[]
}

/**
 * Les fiches en impaye (ADR 060 §3), lues par le fournisseur actif. Une
 * erreur de lecture remonte, typee : jamais de repli sur « tous » ni « vide ».
 */
const unpaidProfileIdsAmong = async (
  organizationId: string,
  profileIds: readonly string[]
): Promise<Set<string>> => {
  try {
    const settings = await getAssociationSettingsService(organizationId)
    const invoices = await resolveMemberBillingProvider(
      settings
    ).listInvoicesOf(organizationId, profileIds)
    return unpaidProfileIdsOf(
      invoices,
      getInvoiceStatusClassification(settings)
    )
  } catch (error) {
    throw new CampaignTargetUnavailableError({cause: error})
  }
}

/** Les fiches d'un groupe ; introuvable sous le tenant → refuse, jamais « tous ». */
const groupProfileIdsOf = async (groupId: string): Promise<Set<string>> => {
  const group = await getRecipientGroupByIdDao(groupId)
  if (!group) throw new NotFoundError(GROUP_NOT_FOUND)
  return new Set(await getRecipientGroupMemberIdsDao(groupId))
}

/** Les fiches de la cible choisie, une par identifiant. A appeler sous le tenant. */
const lotProfilesOf = async (
  organizationId: string,
  target: DocumentLotTarget
): Promise<LotProfileRow[]> => {
  const rows = uniqueProfilesOf(await getCampaignTargetRowsDao(organizationId))
  if (target.kind === 'all_members') return rows
  const targeted =
    target.kind === 'group'
      ? await groupProfileIdsOf(target.groupId)
      : await unpaidProfileIdsAmong(
          organizationId,
          rows.map((row) => row.memberProfileId)
        )
  return rows.filter((row) => targeted.has(row.memberProfileId))
}

const byProfileName = (a: LotProfileRow, b: LotProfileRow): number =>
  a.name.localeCompare(b.name, 'fr', {sensitivity: 'base'}) ||
  a.memberProfileId.localeCompare(b.memberProfileId)

/**
 * La portee d'un lot (critere 3) : une fiche = un document, triees par nom,
 * avec le nombre de fiches sans parcelle actuelle. Pas de desinscription :
 * un document n'est pas un envoi. Exige les deux actions : un lot depose.
 */
export const getDocumentLotReachService = async (input: {
  organizationId: string
  target: DocumentLotTarget
}): Promise<DocumentLotReachDTO> => {
  const orgId = parseOrThrow(
    documentTemplateOrganizationIdSchema,
    input.organizationId
  )
  const target = parseOrThrow(campaignTargetSchema, input.target)
  await requireDocumentDepositor(orgId)

  const rows = await withTenant(orgId, () => lotProfilesOf(orgId, target))
  const profiles = [...rows].sort(byProfileName).map((row) => ({
    id: row.memberProfileId,
    name: row.name,
    hasCurrentParcel: row.currentParcelNumbers.length > 0,
  }))
  return {
    profiles,
    total: profiles.length,
    withoutCurrentParcel: profiles.filter((p) => !p.hasCurrentParcel).length,
  }
}

/** Les groupes que le lot peut viser, sous l'action des modeles (ADR 074 §6). */
export const listDocumentLotGroupsService = async (
  organizationId: string
): Promise<RecipientGroupDTO[]> => {
  const orgId = parseOrThrow(
    documentTemplateOrganizationIdSchema,
    organizationId
  )
  await requireTemplatesManager(orgId)
  return withTenant(orgId, () => listRecipientGroupsDao(orgId))
}

/**
 * Pour qui, sur l'ecran 3 : l'adresse que la lettre imprimera, domicile, sinon
 * terrain, sinon nom seul (ADR 067). `undefined` hors du tenant.
 */
export const getTemplateDocumentRecipientService = async (input: {
  organizationId: string
  memberProfileId: string
}): Promise<DocumentRecipientDTO | undefined> => {
  const data = parseOrThrow(documentRecipientServiceSchema, input)
  await requireTemplatesManager(data.organizationId)
  const profile = await withTenant(data.organizationId, () =>
    getMemberProfileByIdDao(data.memberProfileId)
  )
  return profile
    ? {addressLines: letterAddressLinesOf(profile).lines}
    : undefined
}
