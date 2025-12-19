import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {getReferenceIdByBillingMode} from '@/lib/helper/subscription-helper'
import {
  getAuthUser,
  getAuthUserId,
} from '@/services/authentication/auth-service'
import {
  OrganizationContext,
  UserOrganizationRoleConst,
} from '@/services/types/domain/auth-types'

import {LimitTypeConst} from '../types/domain/subscription-types'
import {
  getUserRoleInOrganization,
  isOrganizationAdmin,
  isOrganizationOwner,
  userCan,
  userCanOnResource,
} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'
import {checkSubscriptionLimit} from './subscription-authorization'
import {isAuthAdmin} from './user-authorization'

/**
 * Système d'autorisation pour les organisations avec contexte organisationnel
 *
 * Hiérarchie des rôles dans une organisation :
 * - OWNER : Peut tout faire (modifier, supprimer l'org, gérer tous les membres)
 * - ADMIN : Peut modifier l'org et gérer les membres (sauf autres ADMIN/OWNER)
 * - MEMBER : Peut uniquement lire l'organisation
 *
 * Permissions système :
 * - Utilisateurs avec rôle ADMIN/SUPER_ADMIN système : Peuvent gérer toutes les organisations
 * - Utilisateurs connectés : Peuvent lire toutes les organisations et en créer
 * - Guests : Peuvent uniquement lire les informations publiques
 *
 * Le système utilise maintenant le contexte organisationnel pour des permissions fines.
 *
 * Exemple d'utilisation dans un service :
 * ```typescript
 * export const updateOrganizationService = async (orgId: string, data: UpdateOrganization) => {
 *   const granted = await canUpdateOrganization(orgId)
 *   if (!granted) {
 *     throw new AuthorizationError()
 *   }
 *   return await updateOrganizationDao(data)
 * }
 * ```
 */

/**
 * Vérifie si l'utilisateur connecté peut lire une organisation
 * @param resourceId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canReadOrganization = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId: resourceId,
  }

  // Vérification précoce pour performance
  if (
    !userCan(
      authUser,
      ActionsConst.READ,
      SubjectsConst.ORGANIZATION,
      orgContext
    )
  ) {
    return false
  }

  // Récupération de l'organisation
  const organization = await getOrganizationByIdDao(resourceId)
  if (!organization) return false

  // Utiliser CASL avec contexte organisationnel
  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.ORGANIZATION,
    {
      id: organization.id,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut créer une organisation
 * @returns true si l'accès est autorisé
 */
export const canCreateOrganization = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCan(authUser, ActionsConst.CREATE, SubjectsConst.ORGANIZATION)
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour une organisation
 * @param resourceId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canUpdateOrganization = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId: resourceId,
  }

  // Vérification avec contexte organisationnel
  const organization = await getOrganizationByIdDao(resourceId)
  if (!organization) return false

  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.ORGANIZATION,
    {
      id: organization.id,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer une organisation
 * @param resourceId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canDeleteOrganization = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  // const orgContext: OrganizationContext = {
  //   organizationId: resourceId,
  // }

  // Les admins système peuvent supprimer toute organisation
  if (userCan(authUser, ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)) {
    return true
  }

  // Seul le OWNER peut supprimer l'organisation
  return isOrganizationOwner(authUser, resourceId)
}

/**
 * Vérifie si l'utilisateur connecté peut lire les membres d'une organisation
 * @param resourceId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canReadOrganizationMember = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId: resourceId,
  }

  // Vérification précoce pour performance
  if (!userCan(authUser, ActionsConst.READ, SubjectsConst.USER, orgContext)) {
    return false
  }

  // Récupération de l'organisation pour vérifier son existence
  const organization = await getOrganizationByIdDao(resourceId)
  if (!organization) return false

  // Utiliser CASL avec contexte organisationnel
  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.USER,
    {
      organizationId: resourceId,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut gérer les membres d'une organisation
 * @param resourceId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canManageOrganizationMembers = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Les admins système peuvent gérer tous les membres
  if (userCan(authUser, ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)) {
    return true
  }

  // OWNER et ADMIN peuvent gérer les membres
  return (
    isOrganizationOwner(authUser, resourceId) ||
    isOrganizationAdmin(authUser, resourceId)
  )
}

/**
 * Vérifie si l'utilisateur connecté peut inviter des membres dans une organisation
 * Vérifie à la fois les permissions ET les limites d'abonnement
 * @param organizationId - ID de l'organisation
 * @param requestedAmount - Nombre de membres à inviter (défaut: 1)
 * @returns true si l'accès est autorisé
 */
export const canInviteToOrganization = async (
  organizationId: string,
  requestedAmount: number = 1
): Promise<boolean> => {
  const isAdmin = await isAuthAdmin()
  if (isAdmin) return true

  // 1️⃣ Vérification des permissions (rôle dans l'organisation)
  const hasPermission = await canManageOrganizationMembers(organizationId)

  if (!hasPermission) return false

  // 2️⃣ Vérification des limites d'abonnement
  const userId = await getAuthUserId()
  const referenceId = getReferenceIdByBillingMode(userId, organizationId)
  if (!referenceId) return false

  const limitCheck = await checkMembersLimit(referenceId, requestedAmount)
  return limitCheck.allowed
}

/**
 * Vérifie si l'utilisateur connecté peut retirer un membre d'une organisation
 * @param resourceId - ID de l'organisation
 * @param targetUserId - ID de l'utilisateur à retirer
 * @returns true si l'accès est autorisé
 */
export const canRemoveFromOrganization = async (
  resourceId: string,
  targetUserId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Les admins système peuvent retirer n'importe qui
  if (userCan(authUser, ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)) {
    return true
  }

  if (!authUser?.id) return false

  // L'utilisateur peut se retirer lui-même
  if (authUser.id === targetUserId) {
    return true
  }

  // Vérifier le rôle de l'utilisateur connecté
  const userRole = getUserRoleInOrganization(authUser, resourceId)

  // OWNER peut retirer n'importe qui
  if (userRole === UserOrganizationRoleConst.OWNER) {
    return true
  }

  // ADMIN peut retirer les MEMBER mais pas d'autres ADMIN ou OWNER
  if (userRole === UserOrganizationRoleConst.ADMIN) {
    // Note: Dans une implémentation complète, il faudrait récupérer l'utilisateur cible
    // depuis la base de données pour obtenir ses vraies organisations
    // Pour le moment, on suppose que l'ADMIN ne peut retirer que des MEMBER
    return true // Logique simplifiée - à améliorer avec vraies données utilisateur
  }

  return false
}

/**
 * Vérifie si l'utilisateur connecté peut changer le rôle d'un membre dans une organisation
 * @param resourceId - ID de l'organisation
 * @param targetUserId - ID de l'utilisateur dont on veut changer le rôle
 * @returns true si l'accès est autorisé
 */
export const canChangeOrganizationMemberRole = async (
  resourceId: string,
  targetUserId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Les admins système peuvent changer tous les rôles
  if (userCan(authUser, ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)) {
    return true
  }

  if (!authUser?.id) return false

  // Un utilisateur ne peut pas changer son propre rôle
  if (authUser.id === targetUserId) {
    return false
  }

  // Seul le OWNER peut changer les rôles
  return isOrganizationOwner(authUser, resourceId)
}

/**
 * Vérifie si l'utilisateur connecté peut lire les utilisateurs d'une organisation
 * @param organizationId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canReadOrganizationUsers = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.USER,
    {
      organizationId,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut gérer les utilisateurs d'une organisation
 * @param organizationId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canManageOrganizationUsers = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.MANAGE,
    SubjectsConst.USER,
    {
      organizationId,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire les subscriptions d'une organisation
 * @param organizationId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canReadOrganizationSubscriptions = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.SUBSCRIPTION,
    {
      organizationId,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut gérer les subscriptions d'une organisation
 * @param organizationId - ID de l'organisation
 * @returns true si l'accès est autorisé
 */
export const canManageOrganizationSubscriptions = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Créer le contexte organisationnel
  const orgContext: OrganizationContext = {
    organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.MANAGE,
    SubjectsConst.SUBSCRIPTION,
    {
      organizationId,
    },
    orgContext
  )
}
/**
 * Vérifie les limites de membres pour une organisation
 * @param referenceId - ID de référence (organizationId en mode ORGANIZATION, userId en mode USER)
 * @param requestedAmount - Nombre de membres à inviter (défaut: 1)
 * @returns Résultat de la vérification des limites
 */
export const checkMembersLimit = async (
  referenceId: string,
  requestedAmount: number = 1
) => {
  const limitCheck = await checkSubscriptionLimit(
    LimitTypeConst.USERS,
    referenceId,
    requestedAmount
  )
  return limitCheck
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer une invitation
 * Seuls les admins système peuvent hard delete les invitations
 * @returns true si l'accès est autorisé
 */
export const canDeleteInvitation = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Seuls les admins système peuvent hard delete les invitations
  return userCan(authUser, ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)
}

/**
 * Vérifie si l'utilisateur connecté peut modifier les limitOverrides d'une organisation
 * Seuls les admins système peuvent modifier les limitOverrides
 * @returns true si l'accès est autorisé
 */
export const canUpdateOrganizationLimitOverrides =
  async (): Promise<boolean> => {
    return isAuthAdmin()
  }
