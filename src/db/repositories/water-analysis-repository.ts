import {count, desc, eq} from 'drizzle-orm'

import {
  waterAnalysis,
  WaterAnalysisModel,
} from '@/db/models/water-analysis-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Analyses d'eau d'une association (s09, ADR 026). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export type WaterAnalysisPageRows = {
  rows: WaterAnalysisModel[]
  total: number
}

/**
 * Tri public et du bureau : date de prelevement decroissante, puis creation
 * decroissante, puis identifiant — un departage stable, pour que la
 * pagination ne saute ni ne repete une ligne (patron `news`).
 */
const WATER_ANALYSIS_ORDER = [
  desc(waterAnalysis.sampledOn),
  desc(waterAnalysis.createdAt),
  desc(waterAnalysis.id),
] as const

/**
 * Insere une analyse **avec son identifiant**, genere par le service avant
 * l'ecriture des fichiers : il entre dans leurs cles de stockage (ADR 026).
 */
export const createWaterAnalysisDao = async (input: {
  id: string
  organizationId: string
  sampledOn: string
  posterKey: string
  reportKey: string
  reportBytes: number
  content: string
}): Promise<WaterAnalysisModel> => {
  const [row] = await getDb().insert(waterAnalysis).values(input).returning()
  return row
}

export const getWaterAnalysisByIdDao = async (
  analysisId: string
): Promise<WaterAnalysisModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(waterAnalysis)
    .where(eq(waterAnalysis.id, analysisId))
  return row
}

export const updateWaterAnalysisDao = async (
  analysisId: string,
  input: {
    sampledOn: string
    posterKey: string
    reportKey: string
    reportBytes: number
    content: string
  }
): Promise<WaterAnalysisModel> => {
  const [row] = await getDb()
    .update(waterAnalysis)
    .set({...input, updatedAt: new Date()})
    .where(eq(waterAnalysis.id, analysisId))
    .returning()
  return row
}

/** Supprime la ligne et rend ses cles de fichier, ou rien si elle n'existe pas. */
export const deleteWaterAnalysisDao = async (
  analysisId: string
): Promise<Pick<WaterAnalysisModel, 'posterKey' | 'reportKey'> | undefined> => {
  const [row] = await getDb()
    .delete(waterAnalysis)
    .where(eq(waterAnalysis.id, analysisId))
    .returning({
      posterKey: waterAnalysis.posterKey,
      reportKey: waterAnalysis.reportKey,
    })
  return row
}

/** Nombre d'analyses de l'association, sans lire une seule ligne. */
export const countWaterAnalysesDao = async (
  organizationId: string
): Promise<number> => {
  const [{total}] = await getDb()
    .select({total: count()})
    .from(waterAnalysis)
    .where(eq(waterAnalysis.organizationId, organizationId))
  return total
}

/** Liste du bureau, page par page. */
export const getWaterAnalysisPageByOrganizationDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<WaterAnalysisPageRows> => {
  const [rows, total] = await Promise.all([
    getDb()
      .select()
      .from(waterAnalysis)
      .where(eq(waterAnalysis.organizationId, input.organizationId))
      .orderBy(...WATER_ANALYSIS_ORDER)
      .limit(input.limit)
      .offset(input.offset),
    countWaterAnalysesDao(input.organizationId),
  ])
  return {rows, total}
}

/**
 * Liste publique. Identique a celle du bureau : toute analyse est en ligne
 * des sa publication, il n'existe ni statut ni brouillon (ADR 026).
 */
export const getPublishedWaterAnalysisPageDao = async (input: {
  organizationId: string
  limit: number
  offset: number
}): Promise<WaterAnalysisPageRows> =>
  getWaterAnalysisPageByOrganizationDao(input)
