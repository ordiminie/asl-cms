import {z} from 'zod'

import {newsDateSchema} from './news-validation'

/**
 * Validation des analyses d'eau (s09, ADR 026). Le texte trop long et la date
 * future ne sont **pas** refuses ici : ce sont des refus rendus au bureau comme
 * un resultat (`WaterAnalysisIssueConst`), pas des erreurs de requete.
 */

export const waterAnalysisOrganizationIdSchema = z.string().uuid()
export const waterAnalysisIdSchema = z.string().uuid()

/**
 * Date ISO `YYYY-MM-DD` d'un jour qui existe (`2026-02-30` est refusee) :
 * celle des actualites, verifiee en UTC, sans lire l'horloge.
 */
export const waterAnalysisDateSchema = newsDateSchema

/** Texte brut facultatif ; sa longueur est jugee apres `trim`. */
export const waterAnalysisContentSchema = z.string().trim()

export const waterAnalysisPageNumberSchema = z.number().int().min(1)

export const publishWaterAnalysisServiceSchema = z.object({
  organizationId: waterAnalysisOrganizationIdSchema,
  sampledOn: waterAnalysisDateSchema,
  content: waterAnalysisContentSchema,
  today: waterAnalysisDateSchema,
})

export const updateWaterAnalysisServiceSchema = z.object({
  organizationId: waterAnalysisOrganizationIdSchema,
  analysisId: waterAnalysisIdSchema,
  sampledOn: waterAnalysisDateSchema,
  content: waterAnalysisContentSchema,
  today: waterAnalysisDateSchema,
})

export const waterAnalysisReferenceServiceSchema = z.object({
  organizationId: waterAnalysisOrganizationIdSchema,
  analysisId: waterAnalysisIdSchema,
})

export const waterAnalysisListServiceSchema = z.object({
  organizationId: waterAnalysisOrganizationIdSchema,
  page: waterAnalysisPageNumberSchema,
})
