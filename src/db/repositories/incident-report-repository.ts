import {and, asc, count, desc, eq, getTableColumns} from 'drizzle-orm'

import {associationCategory} from '@/db/models/association-category-model'
import {
  incidentReport,
  incidentReportEvent,
  IncidentReportEventModel,
  IncidentReportModel,
} from '@/db/models/incident-report-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Signalements et historique de leurs statuts (s10, ADR 028). Sous RLS
 * forcee : hors `withTenant(organizationId, ...)`, rien ne sort et rien ne
 * s'ecrit.
 */

/**
 * Un signalement lu avec le nom de sa categorie, **supprimee comprise**
 * (critere 5) : `category_deleted_at` dit si elle l'a ete.
 */
export type IncidentReportRow = IncidentReportModel & {
  categoryName: string | null
  categoryDeletedAt: Date | null
}

export type IncidentReportPageRows = {
  rows: IncidentReportRow[]
  total: number
}

/**
 * Le plus recent d'abord, puis l'identifiant : un departage stable, pour que
 * la pagination ne saute ni ne repete une ligne.
 */
const INCIDENT_REPORT_ORDER = [
  desc(incidentReport.createdAt),
  desc(incidentReport.id),
] as const

const selectReportWithCategory = () =>
  getDb()
    .select({
      ...getTableColumns(incidentReport),
      categoryName: associationCategory.name,
      categoryDeletedAt: associationCategory.deletedAt,
    })
    .from(incidentReport)
    .leftJoin(
      associationCategory,
      eq(incidentReport.categoryId, associationCategory.id)
    )

/**
 * Ecrit le signalement **et** son premier evenement, `reported`, sans auteur
 * (« depuis le site »), dans la meme transaction. Aucune colonne de membre ni
 * d'adresse n'est ecrite (critere 8, ADR 025).
 */
export const createIncidentReportTxnDao = async (
  input: Pick<
    IncidentReportModel,
    | 'organizationId'
    | 'categoryId'
    | 'location'
    | 'description'
    | 'reporterName'
    | 'reporterEmail'
    | 'reporterPhone'
  >
): Promise<IncidentReportModel> =>
  getDb().transaction(async (tx) => {
    const [report] = await tx
      .insert(incidentReport)
      .values({...input, status: 'reported'})
      .returning()
    await tx.insert(incidentReportEvent).values({
      organizationId: report.organizationId,
      reportId: report.id,
      status: 'reported',
      authorUserId: null,
      authorName: null,
    })
    return report
  })

export const getIncidentReportsPageDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<IncidentReportPageRows> => {
  const where = eq(incidentReport.organizationId, input.organizationId)
  const [rows, [{total}]] = await Promise.all([
    selectReportWithCategory()
      .where(where)
      .orderBy(...INCIDENT_REPORT_ORDER)
      .limit(input.limit)
      .offset(input.offset),
    getDb().select({total: count()}).from(incidentReport).where(where),
  ])
  return {rows, total}
}

export const getIncidentReportByIdDao = async (
  reportId: string
): Promise<IncidentReportRow | undefined> => {
  const [row] = await selectReportWithCategory().where(
    eq(incidentReport.id, reportId)
  )
  return row
}

/** L'historique d'un signalement, du plus ancien au plus recent. */
export const listIncidentReportEventsDao = async (
  reportId: string
): Promise<IncidentReportEventModel[]> =>
  getDb()
    .select()
    .from(incidentReportEvent)
    .where(eq(incidentReportEvent.reportId, reportId))
    .orderBy(asc(incidentReportEvent.createdAt))

/**
 * Change le statut **si et seulement si** il vaut encore `from` (decision C),
 * puis ecrit l'evenement, dans la meme transaction. Deux membres du bureau qui
 * cliquent en meme temps : le second ne trouve plus `from`, rien n'est ecrit,
 * et il recoit `undefined`.
 */
export const changeIncidentReportStatusTxnDao = async (input: {
  organizationId: string
  reportId: string
  from: string
  to: string
  authorUserId: string
  authorName: string
}): Promise<IncidentReportModel | undefined> =>
  getDb().transaction(async (tx) => {
    const [report] = await tx
      .update(incidentReport)
      .set({status: input.to})
      .where(
        and(
          eq(incidentReport.id, input.reportId),
          eq(incidentReport.status, input.from)
        )
      )
      .returning()
    if (!report) return undefined

    await tx.insert(incidentReportEvent).values({
      organizationId: input.organizationId,
      reportId: report.id,
      status: input.to,
      authorUserId: input.authorUserId,
      authorName: input.authorName,
    })
    return report
  })

export const markIncidentReportNotificationFailedDao = async (
  reportId: string
): Promise<void> => {
  await getDb()
    .update(incidentReport)
    .set({notificationFailed: true})
    .where(eq(incidentReport.id, reportId))
}

/** Combien de signalements par statut, pour la ligne `meta` de la file. */
export const countIncidentReportsByStatusDao = async (
  organizationId: string
): Promise<Record<string, number>> => {
  const rows = await getDb()
    .select({status: incidentReport.status, total: count()})
    .from(incidentReport)
    .where(eq(incidentReport.organizationId, organizationId))
    .groupBy(incidentReport.status)
  return Object.fromEntries(rows.map((row) => [row.status, row.total]))
}

/**
 * Combien de signalements chaque categorie porte, supprimees comprises : le
 * bureau lit, avant de supprimer une categorie, combien de signalements
 * seront conserves (critere 5).
 */
export const countIncidentReportsByCategoryDao = async (
  organizationId: string
): Promise<Record<string, number>> => {
  const rows = await getDb()
    .select({categoryId: incidentReport.categoryId, total: count()})
    .from(incidentReport)
    .where(eq(incidentReport.organizationId, organizationId))
    .groupBy(incidentReport.categoryId)
  return Object.fromEntries(
    rows
      .filter((row) => row.categoryId !== null)
      .map((row) => [row.categoryId, row.total])
  )
}
