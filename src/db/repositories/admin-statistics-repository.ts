import {sql} from 'drizzle-orm'

import {user as users} from '@/db/models/auth-model'
import {organization as organizations} from '@/db/models/auth-model'
import db from '@/db/models/db'

export type AdminStatsData = {
  totalUsers: number
  totalOrganizations: number
  userGrowth: {month: string; count: number}[]
  organizationGrowth: {month: string; count: number}[]
}

// ===== STATISTIQUES TOTALES =====

export const getTotalUsersDao = async (): Promise<number> => {
  const [{totalUsers}] = await db
    .select({totalUsers: sql<string>`count(*)`})
    .from(users)

  return Number(totalUsers)
}

export const getTotalOrganizationsDao = async (): Promise<number> => {
  const [{totalOrganizations}] = await db
    .select({totalOrganizations: sql<string>`count(*)`})
    .from(organizations)

  return Number(totalOrganizations)
}

// ===== DONNÉES DE CROISSANCE =====

export const getUserGrowthDataDao = async (): Promise<
  {month: string; count: number}[]
> => {
  const userGrowthData = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${users.createdAt}), 'YYYY-MM')`,
      count: sql<string>`count(*)`,
    })
    .from(users)
    .where(sql`${users.createdAt} >= NOW() - INTERVAL '6 months'`)
    .groupBy(sql`date_trunc('month', ${users.createdAt})`)
    .orderBy(sql`date_trunc('month', ${users.createdAt})`)

  // Convertir les strings en numbers
  return userGrowthData.map((item) => ({
    month: item.month,
    count: Number(item.count),
  }))
}

export const getOrganizationGrowthDataDao = async (): Promise<
  {month: string; count: number}[]
> => {
  const organizationGrowthData = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${organizations.createdAt}), 'YYYY-MM')`,
      count: sql<string>`count(*)`,
    })
    .from(organizations)
    .where(sql`${organizations.createdAt} >= NOW() - INTERVAL '6 months'`)
    .groupBy(sql`date_trunc('month', ${organizations.createdAt})`)
    .orderBy(sql`date_trunc('month', ${organizations.createdAt})`)

  // Convertir les strings en numbers
  return organizationGrowthData.map((item) => ({
    month: item.month,
    count: Number(item.count),
  }))
}

// ===== FONCTION COMPLÈTE =====

export const getAdminStatisticsDao = async (): Promise<AdminStatsData> => {
  const [totalUsers, totalOrganizations, userGrowth, organizationGrowth] =
    await Promise.all([
      getTotalUsersDao(),
      getTotalOrganizationsDao(),
      getUserGrowthDataDao(),
      getOrganizationGrowthDataDao(),
    ])

  return {
    totalUsers,
    totalOrganizations,
    userGrowth,
    organizationGrowth,
  }
}
