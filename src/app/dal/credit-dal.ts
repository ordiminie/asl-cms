import {cache} from 'react'

import {
  canConsumeService,
  getBalanceService,
  getCreditBalanceService,
  getCreditPacksService,
  getRecentActivityService,
  getUsageGraphDataService,
} from '@/services/facades/credit-service-facade'
import {
  CreditActivityItem,
  CreditBalanceDTO,
  CreditPackConfig,
  CreditUsageDay,
} from '@/services/types/domain/credit-types'

// ========================================
// BALANCE DAL
// ========================================

/**
 * Récupère le solde de crédits d'une organisation
 * Cached per request avec react cache
 */
export const getCreditBalanceDal = cache(
  async (organizationId: string): Promise<number> => {
    return getBalanceService(organizationId)
  }
)

/**
 * Récupère les informations complètes de balance pour l'UI
 * Cached per request avec react cache
 */
export const getCreditBalanceDetailsDal = cache(
  async (organizationId: string): Promise<CreditBalanceDTO> => {
    return getCreditBalanceService(organizationId)
  }
)

/**
 * Vérifie si l'organisation peut consommer un montant de crédits
 */
export const canConsumeCreditsDal = cache(
  async (organizationId: string, amount: number): Promise<boolean> => {
    return canConsumeService(organizationId, amount)
  }
)

// ========================================
// USAGE GRAPH DAL
// ========================================

/**
 * Récupère les données du graphique d'usage quotidien
 * Cached per request avec react cache
 */
export const getCreditUsageGraphDal = cache(
  async (
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<CreditUsageDay[]> => {
    return getUsageGraphDataService(organizationId, periodStart, periodEnd)
  }
)

// ========================================
// ACTIVITY TIMELINE DAL
// ========================================

/**
 * Récupère l'activité récente (timeline) des crédits
 * Cached per request avec react cache
 */
export const getRecentCreditActivityDal = cache(
  async (
    organizationId: string,
    limit: number = 20
  ): Promise<CreditActivityItem[]> => {
    return getRecentActivityService(organizationId, limit)
  }
)

// ========================================
// CREDIT PACKS DAL
// ========================================

/**
 * Récupère les packs de crédits disponibles
 * Cached per request avec react cache
 */
export const getCreditPacksDal = cache(
  async (): Promise<CreditPackConfig[]> => {
    return getCreditPacksService()
  }
)
