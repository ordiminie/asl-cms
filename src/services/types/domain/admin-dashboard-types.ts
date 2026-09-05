// Types de domaine pour les statistiques admin
export type AdminDashboardStats = {
  totalUsers: number
  totalOrganizations: number
  userGrowth: {month: string; count: number}[]
  organizationGrowth: {month: string; count: number}[]
}

export type UserGrowthData = {
  month: string
  count: number
}

export type OrganizationGrowthData = {
  month: string
  count: number
}
