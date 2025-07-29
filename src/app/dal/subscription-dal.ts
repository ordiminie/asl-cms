import {unstable_cache as nextCache} from 'next/cache'
import {cache} from 'react'

import {
  getActiveSubscriptions,
  getSessionReferenceId,
} from '@/services/authentication/auth-service'
import {checkSubscriptionLimit} from '@/services/authorization/subscription-authorization'
import {
  getPlanByCodePublicService,
  getPlanByPriceIdPublicService,
  getPlansWithPaginationService,
  getSubscriptionsWithPaginationService,
  isYearlyPriceService,
} from '@/services/facades/subscription-service-facade'
import {Pagination} from '@/services/types/common-type'
import {
  LimitType,
  PlanConst,
  PlanDTO,
} from '@/services/types/domain/subscription-types'

export const getActiveSubscriptionsDal = cache(async () => {
  const referenceId = await getSessionReferenceId()
  if (!referenceId) {
    throw new Error('No referenceId found')
  }
  const subscriptions = await getActiveSubscriptions(referenceId)
  return subscriptions
})

export const checkSubscriptionLimitDal = cache(
  async (limitType: LimitType, requestedAmount: number = 1) => {
    return checkSubscriptionLimit(limitType, requestedAmount)
  }
)

export const getPlanByPriceId = cache((priceId: string) =>
  nextCache(
    async (): Promise<PlanDTO | undefined> => {
      return getPlanByPriceIdPublicService(priceId)
    },
    ['plan-by-price-id', priceId],
    {
      tags: ['plans'],
      revalidate: 3600, // 1 heure
    }
  )()
)

export const isYearlyPrice = cache(async (priceId?: string | null) => {
  if (!priceId) {
    return false
  }
  return isYearlyPriceService(priceId)
})

export const getPlanByCodeDal = cache((code: string) =>
  nextCache(
    async (): Promise<PlanDTO | undefined> => {
      return getPlanByCodePublicService(code)
    },
    ['plan-by-code', code],
    {
      tags: ['plans'],
      revalidate: 3600, // 1 heure
    }
  )()
)

// ========================================
// SERVICES HELPER POUR LES PLANS SPÉCIFIQUES
// ========================================

/**
 * Obtenir le plan PRO
 */
export const getProPlan = cache(async (): Promise<PlanDTO | undefined> => {
  return getPlanByCodeDal(PlanConst.PRO)
})

/**
 * Obtenir le plan FREE
 */
export const getFreePlan = cache(async (): Promise<PlanDTO | undefined> => {
  return getPlanByCodeDal(PlanConst.FREE)
})

/**
 * Obtenir le plan ENTREPRISE
 */
export const getEntreprisePlan = cache(
  async (): Promise<PlanDTO | undefined> => {
    return getPlanByCodeDal(PlanConst.ENTREPRISE)
  }
)

/**
 * Obtenir le plan LIFETIME
 */
export const getLifetimePlan = cache(async (): Promise<PlanDTO | undefined> => {
  return getPlanByCodeDal(PlanConst.LIFETIME)
})

// ========================================
// DAL POUR LA GESTION ADMIN DES PLANS
// ========================================

/**
 * Obtenir tous les plans avec pagination pour l'admin
 */
export const getPlansWithPaginationDal = cache(
  async (pagination: Pagination, search?: string) => {
    return getPlansWithPaginationService(pagination, search)
  }
)

/**
 * Obtenir les permissions admin pour les plans
 */
export const getPlanAdminPermissionsDal = cache(async () => {
  // Retourne les permissions disponibles pour l'admin
  return {
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canView: true,
  }
})

// ========================================
// DAL POUR LA GESTION ADMIN DES SUBSCRIPTIONS
// ========================================

/**
 * Obtenir toutes les subscriptions avec pagination pour l'admin
 */
export const getSubscriptionsWithPaginationDal = cache(
  async (pagination: Pagination, search?: string) => {
    return getSubscriptionsWithPaginationService(pagination, search)
  }
)

/**
 * Obtenir les permissions admin pour les subscriptions
 */
export const getSubscriptionAdminPermissionsDal = cache(async () => {
  // Retourne les permissions disponibles pour l'admin
  console.warn('getSubscriptionAdminPermissionsDal todo')
  return {
    canView: true,
    canCancel: true,
    canReactivate: true,
  }
})
