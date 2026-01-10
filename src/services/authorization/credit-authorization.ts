import {getAuthUser} from '../authentication/auth-service'
import {
  getUserRoleInOrganization,
  isUserAdmin,
  userCan,
  userCanOnResource,
} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'

/**
 * Vérifie si l'utilisateur peut lire les crédits d'une organisation
 * - ADMIN global : peut lire toutes les orgs
 * - USER membre de l'org : peut lire son org
 */
export const canReadCredits = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  // Admin global peut lire tous les crédits
  if (isUserAdmin(authUser)) {
    return true
  }

  // Vérifier que l'utilisateur est membre de l'organisation
  const orgRole = getUserRoleInOrganization(authUser, organizationId)
  if (!orgRole) return false

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.CREDIT,
    {organizationId},
    {organizationId}
  )
}

/**
 * Vérifie si l'utilisateur peut consommer des crédits d'une organisation
 * - ADMIN global : peut consommer pour toutes les orgs
 * - USER membre de l'org : peut consommer pour son org
 */
export const canConsumeCredits = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  // Admin global peut consommer des crédits pour toutes les orgs
  if (isUserAdmin(authUser)) {
    return true
  }

  // Vérifier que l'utilisateur est membre de l'organisation
  const orgRole = getUserRoleInOrganization(authUser, organizationId)
  if (!orgRole) return false

  // Les membres peuvent consommer (UPDATE sur Credit)
  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.CREDIT,
    {organizationId},
    {organizationId}
  )
}

/**
 * Vérifie si l'utilisateur peut accorder des crédits (grant)
 * - Seul l'ADMIN global peut accorder des crédits
 */
export const canGrantCredits = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  // Seul l'admin global peut accorder des crédits
  return (
    isUserAdmin(authUser) &&
    userCan(authUser, ActionsConst.CREATE, SubjectsConst.CREDIT)
  )
}

/**
 * Vérifie si l'utilisateur peut acheter des packs de crédits pour une organisation
 * - ADMIN global : peut acheter pour toutes les orgs
 * - OWNER/ADMIN de l'org : peut acheter pour son org
 * - MEMBER : ne peut pas acheter
 */
export const canPurchasePack = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  // Admin global peut acheter pour toutes les orgs
  if (isUserAdmin(authUser)) {
    return true
  }

  // Vérifier que l'utilisateur est OWNER ou ADMIN de l'organisation
  const orgRole = getUserRoleInOrganization(authUser, organizationId)
  if (!orgRole) return false

  // Seuls OWNER et ADMIN peuvent acheter des packs
  if (orgRole === 'owner' || orgRole === 'admin') {
    return userCanOnResource(
      authUser,
      ActionsConst.CREATE,
      SubjectsConst.CREDIT,
      {organizationId},
      {organizationId}
    )
  }

  return false
}

/**
 * Vérifie si l'utilisateur peut voir l'historique des crédits d'une organisation
 * Même permissions que canReadCredits
 */
export const canReadCreditHistory = async (
  organizationId: string
): Promise<boolean> => {
  return canReadCredits(organizationId)
}

/**
 * Vérifie si l'utilisateur peut voir les stats de crédits de toutes les orgs (admin dashboard)
 * - Seul l'ADMIN global peut voir les stats globales
 */
export const canReadAllCreditsStats = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  return isUserAdmin(authUser)
}
