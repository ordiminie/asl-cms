import {cache} from 'react'

import {getDashboardStatsService} from '@/services/facades/admin-dashboard-service-facade'
import {getAdminStripeSubscriptionMRRService} from '@/services/facades/subscription-service-facade'
import {AdminDashboardStats} from '@/services/types/domain/admin-dashboard-types'

export type AdminDashboardStatsDTO = {
  totalUsers: number
  totalOrganizations: number
  userGrowth: {month: string; count: number}[]
  organizationGrowth: {month: string; count: number}[]
}

export const getAdminDashboardStatsDal = cache(
  async (): Promise<AdminDashboardStatsDTO> => {
    const stats: AdminDashboardStats = await getDashboardStatsService()

    // Transformation des données de domaine en DTO pour la présentation
    return {
      totalUsers: stats.totalUsers,
      totalOrganizations: stats.totalOrganizations,
      userGrowth: stats.userGrowth,
      organizationGrowth: stats.organizationGrowth,
    }
  }
)

/**
 * Obtenir les statistiques MRR pour le dashboard admin
 */
export const getAdminStripeSubscriptionMRRDal = cache(async () => {
  return getAdminStripeSubscriptionMRRService()
})
