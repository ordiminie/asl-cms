import {getAdminStatisticsDao} from '@/db/repositories/admin-statistics-repository'

import {canAccessAdminDashboard} from './authorization/admin-dashboard-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {AdminDashboardStats} from './types/domain/admin-dashboard-types'
import {
  adminDashboardStatsSchema,
  getDashboardStatsParamsSchema,
} from './validation/admin-dashboard-validation'

/**
 * Service pour récupérer les statistiques du dashboard admin
 * @returns {Promise<AdminDashboardStats>} Les statistiques complètes du dashboard
 */
export const getDashboardStatsService =
  async (): Promise<AdminDashboardStats> => {
    // 1. Vérifier les autorisations
    const granted = await canAccessAdminDashboard()
    if (!granted) {
      throw new AuthorizationError()
    }

    try {
      // 2. Récupérer les données depuis le repository
      const rawStats = await getAdminStatisticsDao()

      // 3. Valider les données de sortie avec Zod
      const parsed = adminDashboardStatsSchema.safeParse(rawStats)
      if (!parsed.success) {
        throw new ValidationError(parsed.error.message)
      }

      return parsed.data
    } catch (error) {
      if (
        error instanceof AuthorizationError ||
        error instanceof ValidationError
      ) {
        throw error
      }
      // Log de l'erreur et re-throw avec un message générique
      console.error('Error fetching admin dashboard stats:', error)
      throw new Error('Erreur lors de la récupération des statistiques')
    }
  }

/**
 * Service pour récupérer les statistiques avec paramètres personnalisés
 * @param params - Paramètres de la requête (ex: nombre de mois)
 * @returns {Promise<AdminDashboardStats>} Les statistiques du dashboard
 */
export const getDashboardStatsWithParamsService = async (params?: {
  months?: number
}): Promise<AdminDashboardStats> => {
  // 1. Vérifier les autorisations
  const granted = await canAccessAdminDashboard()
  if (!granted) {
    throw new AuthorizationError()
  }

  // 2. Valider les paramètres d'entrée
  const parsedParams = getDashboardStatsParamsSchema.safeParse(params || {})
  if (!parsedParams.success) {
    throw new ValidationError(parsedParams.error.message)
  }

  // Pour l'instant, on utilise la même fonction DAO
  // À terme, on pourrait créer une version paramétrable
  return await getDashboardStatsService()
}
