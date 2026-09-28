import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  canManageWaterAnalysisService,
  getPublicWaterAnalysesPageService,
  getPublicWaterAnalysisPageCountService,
  getWaterAnalysesForBureauService,
  getWaterAnalysisForBureauService,
} from '@/services/facades/water-analysis-service-facade'
import {contentFileUrl} from '@/services/types/domain/content-file-types'
import {
  WaterAnalysisDTO,
  WaterAnalysisListPageDTO,
} from '@/services/types/domain/water-analysis-types'

/**
 * Tag d'invalidation de la liste publique des analyses d'eau d'une
 * association. Les tags sont stockes en clair : rien d'autre que
 * l'identifiant de l'association.
 *
 * Les Server Actions du bureau appellent
 * `updateTag(waterAnalysisListTag(...))` **apres** le succes de l'ecriture —
 * publier, corriger ou supprimer change toujours la liste.
 */
export const waterAnalysisListTag = (organizationId: string): string =>
  `water-analysis:${organizationId}`

/**
 * Lecture cachee d'une page de la liste publique. Fonction **interne** : elle
 * prend l'identifiant de l'association en argument, et seul l'appelant
 * ci-dessous le fournit — celui du domaine appele.
 *
 * Aucun appel direct a `logger`, aucune horloge, aucune lecture de requete
 * dans ce scope (patron `news-dal.ts`).
 */
const readPublicWaterAnalysesPageCached = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<WaterAnalysisListPageDTO> => {
    'use cache'
    cacheLife('hours')
    cacheTag(waterAnalysisListTag(organizationId))

    return getPublicWaterAnalysesPageService(organizationId, page)
  }
)

/** La liste servie au visiteur, page par page. */
export const getPublicWaterAnalysesPageDal = async (
  organizationId: string,
  page: number
): Promise<WaterAnalysisListPageDTO> =>
  readPublicWaterAnalysesPageCached(organizationId, page)

/**
 * Nombre de pages de la liste publique. Sa cle de cache ne depend **que** de
 * l'association, et son tag est celui de la liste : la page publique borne le
 * numero demande avant de toucher la lecture cachee par page.
 */
const readPublicWaterAnalysisPageCountCached = cache(
  async (organizationId: string): Promise<number> => {
    'use cache'
    cacheLife('hours')
    cacheTag(waterAnalysisListTag(organizationId))

    return getPublicWaterAnalysisPageCountService(organizationId)
  }
)

export const getPublicWaterAnalysisPageCountDal = async (
  organizationId: string
): Promise<number> => readPublicWaterAnalysisPageCountCached(organizationId)

/**
 * Liste de gestion du bureau. Non cachee : c'est un ecran d'administration,
 * qui doit refleter la derniere modification sans attendre une invalidation.
 */
export const getWaterAnalysesForBureauDal = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<WaterAnalysisListPageDTO> =>
    getWaterAnalysesForBureauService(organizationId, page)
)

/**
 * Une analyse du bureau, pour l'ecran de correction. Non cachee. Seule
 * l'absence devient `undefined`, que l'appelant traduit en 404 : une panne ou
 * un refus d'autorisation remonte.
 */
export const getWaterAnalysisForBureauDal = cache(
  async (
    organizationId: string,
    analysisId: string
  ): Promise<WaterAnalysisDTO | undefined> =>
    getWaterAnalysisForBureauService(organizationId, analysisId).catch(
      (error: unknown) => {
        if (error instanceof NotFoundError) return undefined
        throw error
      }
    )
)

/**
 * L'utilisateur connecte peut-il gerer les analyses d'eau de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentWaterAnalysisDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageWaterAnalysisService(tenant.id)
  }
)

/** Adresse publique d'une affiche ou d'un PDF d'analyse. */
export const waterAnalysisFileUrl = (key: string): string => contentFileUrl(key)
