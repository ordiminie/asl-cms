import {getAuthUser} from '@/services/authentication/auth-service'
import {canManageUsers} from '@/services/authorization/user-authorization'

/**
 * Vérifie si l'utilisateur connecté peut accéder aux statistiques admin
 * @returns {Promise<boolean>} true si l'utilisateur peut accéder aux stats admin
 */
export const canAccessAdminDashboard = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  // Utiliser la fonction existante de gestion des utilisateurs
  // qui vérifie déjà les rôles admin
  return await canManageUsers()
}

/**
 * Vérifie si l'utilisateur connecté peut voir les statistiques des utilisateurs
 * @returns {Promise<boolean>} true si l'utilisateur peut voir les stats utilisateurs
 */
export const canViewUserStatistics = async (): Promise<boolean> => {
  return await canAccessAdminDashboard()
}

/**
 * Vérifie si l'utilisateur connecté peut voir les statistiques des organisations
 * @returns {Promise<boolean>} true si l'utilisateur peut voir les stats organisations
 */
export const canViewOrganizationStatistics = async (): Promise<boolean> => {
  return await canAccessAdminDashboard()
}
