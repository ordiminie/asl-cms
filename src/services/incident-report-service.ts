import 'server-only'

import {AssociationCategoryModel} from '@/db/models/association-category-model'
import {IncidentReportModel} from '@/db/models/incident-report-model'
import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {
  changeIncidentReportStatusTxnDao,
  countIncidentReportsByStatusDao,
  createIncidentReportTxnDao,
  getIncidentReportByIdDao,
  getIncidentReportsPageDao,
  IncidentReportRow,
  listIncidentReportEventsDao,
  markIncidentReportNotificationFailedDao,
} from '@/db/repositories/incident-report-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {sendIncidentReportNotificationEmailService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {CategoryDomainConst} from './types/domain/association-category-types'
import {getIdentityVersionFromKey} from './types/domain/association-identity-types'
import {
  CONTACT_EMAIL_SETTING_KEY,
  getAccentHue,
} from './types/domain/association-settings-types'
import {
  countIncidentReportPages,
  CreateIncidentReportInput,
  INCIDENT_REPORTS_BUREAU_PAGE_SIZE,
  IncidentReportDTO,
  IncidentReportEventDTO,
  IncidentReportListItemDTO,
  IncidentReportListPageDTO,
  IncidentReportStatusChangeResult,
  IncidentReportStatusCounts,
  IncidentReportSubmissionResult,
  REPORT_STATUSES,
  ReportStatus,
  resolveReportRecipients,
} from './types/domain/incident-report-types'
import {
  changeIncidentReportStatusServiceSchema,
  createIncidentReportServiceSchema,
  hasReachedReportStatus,
  incidentReportOrganizationIdSchema,
  incidentReportServiceSchema,
  incidentReportsPageServiceSchema,
  previousReportStatusOf,
} from './validation/incident-report-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut suivre les signalements"
const REPORT_NOT_FOUND = 'Signalement introuvable'
const CATEGORY_NOT_OFFERED =
  "La catégorie choisie n'est pas proposée par l'association"
const CATEGORY_REQUIRED = 'Une catégorie est obligatoire'
const TRANSITION_REFUSED = 'Ce changement de statut n’est pas permis'

const toListItemDto = (row: IncidentReportRow): IncidentReportListItemDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  categoryName: row.categoryName,
  categoryDeleted: row.categoryDeletedAt !== null,
  location: row.location,
  reporterName: row.reporterName,
  reporterEmail: row.reporterEmail,
  reporterPhone: row.reporterPhone,
  status: row.status as ReportStatus,
  notificationFailed: row.notificationFailed,
  createdAt: row.createdAt,
})

const toEventDto = (event: {
  id: string
  status: string
  authorName: string | null
  createdAt: Date
}): IncidentReportEventDTO => ({
  id: event.id,
  status: event.status as ReportStatus,
  authorName: event.authorName,
  createdAt: event.createdAt,
})

const toStatusCounts = (
  totals: Record<string, number>
): IncidentReportStatusCounts =>
  Object.fromEntries(
    REPORT_STATUSES.map((status) => [status, totals[status] ?? 0])
  ) as IncidentReportStatusCounts

const requireReportsManager = async (organizationId: string) => {
  const authUser = await getAuthUser()
  if (
    !authUser ||
    !canPerformAction(authUser, organizationId, ActionIdConst.REPORT_MANAGE)
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  return authUser
}

/** Logo PNG de l'association, servi par sa propre origine (comme s03). */
const pngLogoUrlOf = (
  logoKey: string | null | undefined,
  origin: string
): string | undefined => {
  const version = getIdentityVersionFromKey(logoKey)
  if (!version || !logoKey?.endsWith('.png')) return undefined
  return `${origin}/api/identity/logo?v=${encodeURIComponent(version)}`
}

/**
 * La categorie retenue pour le signalement (decision D). Lue **dans le scope
 * du tenant** : un identifiant d'une autre association n'y est pas visible,
 * donc refuse. Sans aucune categorie active, le signalement part sans.
 */
const resolveReportCategory = async (
  organizationId: string,
  categoryId: string | undefined
): Promise<AssociationCategoryModel | null> => {
  const offered = await listActiveCategoriesDao(
    organizationId,
    CategoryDomainConst.REPORT
  )
  if (!categoryId) {
    if (offered.length > 0) throw new ValidationError(CATEGORY_REQUIRED)
    return null
  }

  const category = offered.find((candidate) => candidate.id === categoryId)
  if (!category) throw new ValidationError(CATEGORY_NOT_OFFERED)
  return category
}

/**
 * Avertit le bureau (decision F) : l'adresse de contact, lue **a l'envoi**
 * dans les parametres de l'association (critere 7), jamais dans
 * l'environnement, plus l'adresse de la categorie si elle en porte une —
 * dedupliquees, un envoi par destinataire. Chaque envoi est tente ; si l'un
 * echoue, ou si rien ne peut partir, la fonction leve.
 */
const notifyBoard = async (
  report: IncidentReportModel,
  category: AssociationCategoryModel | null,
  locale: string
): Promise<void> => {
  const [settings, organization] = await Promise.all([
    getAssociationSettingsService(report.organizationId),
    getOrganizationByIdDao(report.organizationId),
  ])
  const contactEmail = settings[CONTACT_EMAIL_SETTING_KEY]?.value
  const recipients = resolveReportRecipients(
    contactEmail ? String(contactEmail) : undefined,
    category?.routingEmail
  )
  const origin = associationOriginOf(organization?.domain)
  if (!contactEmail || !organization || !origin) {
    throw new Error(
      "Adresse de notification ou domaine de l'association absent"
    )
  }

  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  const notification = {
    locale: resolveSupportedLocale(locale),
    association: {
      name: organization.name,
      hue: getAccentHue(settings),
      ...(logoUrl ? {logoUrl} : {}),
    },
    reportUrl: `${origin}/bureau/signalements/${report.id}`,
    report: {
      categoryName: category?.name ?? null,
      location: report.location,
      description: report.description,
      reporterName: report.reporterName,
      reporterEmail: report.reporterEmail,
      reporterPhone: report.reporterPhone,
      createdAt: report.createdAt,
    },
  }
  const sends = await Promise.allSettled(
    recipients.map((to) =>
      sendIncidentReportNotificationEmailService({...notification, to})
    )
  )
  const failed = sends.filter((send) => send.status === 'rejected')
  if (failed.length > 0) {
    throw new Error(
      `${failed.length} envoi(s) sur ${recipients.length} en echec : ${failed
        .map((send) => String((send as PromiseRejectedResult).reason))
        .join(' ; ')}`
    )
  }
}

/**
 * Pose le temoin d'echec. S'il ne se pose pas, le signalement reste
 * enregistre : l'echec est journalise, la soumission n'echoue pas pour autant.
 */
const flagNotificationFailed = async (
  organizationId: string,
  reportId: string
): Promise<void> => {
  try {
    await withTenant(organizationId, () =>
      markIncidentReportNotificationFailedDao(reportId)
    )
  } catch (error) {
    logger.error("[INCIDENT-REPORT] Temoin d'echec de notification non pose", {
      reportId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Enregistre un signalement envoye depuis `/signaler`, puis avertit le bureau.
 *
 * **Sans controle d'autorisation, et c'est delibere** : l'auteur est un
 * visiteur anonyme (precedent : `createContactMessageService`). Ordre :
 * validation -> categorie lue dans le scope du tenant -> ecriture du
 * signalement et de son premier evenement -> notification. Un echec de
 * notification **ne fait pas echouer** la soumission.
 *
 * Aucune adresse IP n'entre ici, et **aucun rapprochement avec un membre** :
 * ni recherche de membre ni de compte a partir des coordonnees, et
 * `member_id` n'est jamais ecrit (critere 8).
 */
export const createIncidentReportService = async (
  input: CreateIncidentReportInput
): Promise<IncidentReportSubmissionResult> => {
  const parsed = createIncidentReportServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, locale, categoryId, location, description} =
    parsed.data
  const {report, category} = await withTenant(organizationId, async () => {
    const category = await resolveReportCategory(organizationId, categoryId)
    const report = await createIncidentReportTxnDao({
      organizationId,
      categoryId: category?.id ?? null,
      location,
      description,
      reporterName: parsed.data.name,
      reporterEmail: parsed.data.email,
      reporterPhone: parsed.data.phone,
    })
    return {report, category}
  })

  try {
    await notifyBoard(report, category, locale)
    return {status: 'created', id: report.id, notificationFailed: false}
  } catch (error) {
    logger.error('[INCIDENT-REPORT] Notification au bureau non envoyee', {
      reportId: report.id,
      error: error instanceof Error ? error.message : String(error),
    })
    await flagNotificationFailed(organizationId, report.id)
    return {status: 'created', id: report.id, notificationFailed: true}
  }
}

/** Une page de la file du bureau, la plus recente d'abord. */
export const getIncidentReportsPageService = async (
  organizationId: string,
  page: number
): Promise<IncidentReportListPageDTO> => {
  const parsed = incidentReportsPageServiceSchema.safeParse({
    organizationId,
    page,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireReportsManager(parsed.data.organizationId)

  const {organizationId: orgId} = parsed.data
  const pageSize = INCIDENT_REPORTS_BUREAU_PAGE_SIZE
  const readPage = (page: number) =>
    getIncidentReportsPageDao({
      organizationId: orgId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

  return withTenant(orgId, async () => {
    const [requested, totals] = await Promise.all([
      readPage(parsed.data.page),
      countIncidentReportsByStatusDao(orgId),
    ])
    const totalPages = countIncidentReportPages(requested.total, pageSize)
    const page = Math.min(parsed.data.page, totalPages)
    const result = page === parsed.data.page ? requested : await readPage(page)

    return {
      items: result.rows.map((row) => toListItemDto(row)),
      page,
      pageSize,
      total: result.total,
      totalPages: countIncidentReportPages(result.total, pageSize),
      counts: toStatusCounts(totals),
    }
  })
}

/** Un signalement du bureau, avec son historique dans l'ordre. */
export const getIncidentReportService = async (
  organizationId: string,
  reportId: string
): Promise<IncidentReportDTO> => {
  const parsed = incidentReportServiceSchema.safeParse({
    organizationId,
    reportId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireReportsManager(parsed.data.organizationId)

  const found = await withTenant(parsed.data.organizationId, async () => {
    const row = await getIncidentReportByIdDao(parsed.data.reportId)
    if (!row || row.organizationId !== parsed.data.organizationId) {
      return undefined
    }
    const events = await listIncidentReportEventsDao(row.id)
    return {row, events}
  })
  if (!found) {
    throw new NotFoundError(REPORT_NOT_FOUND)
  }

  return {
    ...toListItemDto(found.row),
    description: found.row.description,
    events: found.events.map((event) => toEventDto(event)),
  }
}

/**
 * Fait avancer un signalement d'un pas (critere 3, decision C) :
 * `reported` → `in_progress` → `resolved`. L'evenement porte l'utilisateur
 * authentifie et une copie de son nom.
 *
 * - Un saut ou un retour (`reported` → `resolved`, `in_progress` →
 *   `reported`) est refuse (`ValidationError`), sans ecriture.
 * - Un signalement **deja arrive** au statut demande, ou au-dela, rend
 *   `stale` : un autre membre du bureau l'a fait changer entre-temps.
 * - La meme course, perdue au moment de l'ecriture conditionnelle, rend aussi
 *   `stale`.
 */
export const changeIncidentReportStatusService = async (input: {
  organizationId: string
  reportId: string
  to: ReportStatus
}): Promise<IncidentReportStatusChangeResult> => {
  const parsed = changeIncidentReportStatusServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, reportId, to} = parsed.data
  const author = await requireReportsManager(organizationId)

  return withTenant(organizationId, async () => {
    const report = await getIncidentReportByIdDao(reportId)
    if (!report || report.organizationId !== organizationId) {
      throw new NotFoundError(REPORT_NOT_FOUND)
    }

    const current = report.status as ReportStatus
    const from = previousReportStatusOf(to)
    if (from === null) {
      throw new ValidationError(TRANSITION_REFUSED)
    }
    if (current !== from) {
      if (hasReachedReportStatus(current, to)) return {status: 'stale'}
      throw new ValidationError(TRANSITION_REFUSED)
    }

    const changed = await changeIncidentReportStatusTxnDao({
      organizationId,
      reportId,
      from,
      to,
      authorUserId: author.id,
      authorName: author.name,
    })
    return changed
      ? {status: 'changed', reportStatus: to}
      : ({status: 'stale'} as const)
  })
}

/** L'utilisateur connecte peut-il suivre les signalements de cette association ? */
export const canManageIncidentReportsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = incidentReportOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(authUser, parsed.data, ActionIdConst.REPORT_MANAGE)
}
