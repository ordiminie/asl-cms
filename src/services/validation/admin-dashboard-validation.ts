import {z} from 'zod'

import {AdminDashboardStats} from '@/services/types/domain/admin-dashboard-types'

// Schéma pour les données de croissance mensuelle
const growthDataSchema = z.object({
  month: z.string(),
  count: z.number().min(0),
})

// Schéma principal pour les statistiques admin
export const adminDashboardStatsSchema = z.object({
  totalUsers: z.number().min(0),
  totalOrganizations: z.number().min(0),
  userGrowth: z.array(growthDataSchema),
  organizationGrowth: z.array(growthDataSchema),
}) satisfies z.Schema<AdminDashboardStats>

// Validation pour les paramètres de requête (si nécessaire)
export const getDashboardStatsParamsSchema = z.object({
  months: z.number().min(1).max(12).optional().default(6),
})
