import {logger} from 'better-auth'

import {getSubscriptionByIdDao} from '@/db/repositories/subscription-repository'
import {getPlanByIdDao} from '@/db/repositories/subscription-repository'

import {
  getActiveSubscriptions,
  getAuthUser,
} from '../authentication/auth-service'
import {getMembersAndInvitationsService} from '../organization-service'
import {getProjectsByOrganizationService} from '../project-service'
import {
  checkSubscriptionLimitService,
  getPlanByCodeService,
} from '../subscription-service'
import {
  LimitType,
  LimitTypeConst,
  PlanConst,
} from '../types/domain/subscription-types'
import {userCan, userCanOnResource} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'

export const canReadSubscription = async (
  resourceId?: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Si pas d'ID de ressource spécifique, vérifier la permission générale
  if (!resourceId) {
    return userCan(authUser, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)
  }

  // Vérification précoce : si l'utilisateur n'a pas la permission générale, pas besoin d'aller plus loin
  if (!userCan(authUser, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)) {
    return false
  }

  // Récupérer la subscription pour vérifier la propriété
  const subscription = await getSubscriptionByIdDao(resourceId)
  if (!subscription) return false

  // Utiliser CASL pour vérifier les permissions avec condition de propriété
  // Utilise referenceId (userId Better Auth) au lieu de stripeCustomerId
  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.SUBSCRIPTION,
    {
      id: subscription.id,
      userId: subscription.referenceId,
    }
  )
}

export const canUpdateSubscription = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce : si l'utilisateur n'a pas la permission générale, pas besoin d'aller plus loin
  if (!userCan(authUser, ActionsConst.UPDATE, SubjectsConst.SUBSCRIPTION)) {
    return false
  }

  // Récupérer la subscription pour vérifier la propriété
  const subscription = await getSubscriptionByIdDao(resourceId)
  if (!subscription) return false

  // Utiliser CASL pour vérifier les permissions avec condition de propriété
  // Utilise referenceId (userId Better Auth) au lieu de stripeCustomerId
  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.SUBSCRIPTION,
    {
      id: subscription.id,
      userId: subscription.referenceId,
    }
  )
}

/**
 * 🎯 Vérification des limites d'abonnement (DAL → Service)
 * @param limitType - Type de limite à vérifier (USERS, PROJECTS, STORAGE)
 * @param referenceId - ID de référence (userId ou organizationId selon BILLING_MODE)
 * @param requestedAmount - Nombre d'éléments demandés (défaut: 1)
 */
export const checkSubscriptionLimit = async (
  limitType: LimitType,
  referenceId: string,
  requestedAmount: number = 1
) => {
  // 1. Récupérer l'abonnement via Better Auth API
  const subscription = await getActiveSubscriptions(referenceId)

  if (subscription.length === 0) {
    const freeStripePlan = await getPlanByCodeService(PlanConst.FREE)

    // Les limites sont déjà un objet avec Drizzle (pas une chaîne JSON)
    const limits = freeStripePlan?.limits as Record<string, number> | null
    const limitsUsers = limits?.users ?? 1

    subscription.push({
      id: PlanConst.FREE,
      referenceId,
      limits: freeStripePlan?.limits as Record<string, number>,
      priceId: freeStripePlan?.priceId,
      plan: freeStripePlan?.code as string,
      status: 'active',
      seats: limitsUsers,
      stripeCustomerId: PlanConst.FREE,
      stripeSubscriptionId: PlanConst.FREE,
    })
  }
  if (subscription.length > 1) {
    logger.warn('Multiple subscriptions found for referenceId', {referenceId})
  }
  let currentUsage = 0
  switch (limitType) {
    case LimitTypeConst.PROJECTS: {
      const projects = await getProjectsByOrganizationService(referenceId) //todo
      currentUsage = projects.length
      break
    }
    case LimitTypeConst.USERS: {
      const members = await getMembersAndInvitationsService(referenceId) //todo attention en billingmodeuser
      currentUsage = members.length
      break
    }
    case LimitTypeConst.STORAGE:
      throw new Error('Not implemented')

    default:
      throw new Error('Invalid limit type')
  }

  // 2. Appeler le service pour la logique métier
  const sub = subscription[0]
  return checkSubscriptionLimitService(
    {
      limits: sub.limits as Record<string, number> | undefined,
      seats: sub.seats,
      plan: sub.plan,
    },
    limitType,
    currentUsage,
    requestedAmount
  )
}

// ========================================
// AUTORISATION POUR LES PLANS
// ========================================

/**
 * Vérifie si l'utilisateur connecté peut lire un plan spécifique
 * Les plans sont publics en lecture pour tous les utilisateurs connectés
 * @param resourceId - ID du plan (optionnel)
 * @returns true si l'accès est autorisé
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const canReadPlan = async (resourceId?: string): Promise<boolean> => {
  // Récupérer le plan pour vérifier qu'il existe

  // Les plans sont publics en lecture pour tous les utilisateurs connectés
  return true
}

/**
 * Vérifie si l'utilisateur connecté peut créer un plan
 * Seuls les ADMIN et SUPER_ADMIN peuvent créer des plans
 * @returns true si l'accès est autorisé
 */
export const canCreatePlan = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Seuls les admins peuvent créer des plans (ressource technique/système)
  return userCan(authUser, ActionsConst.CREATE, SubjectsConst.TECHNICAL)
}

/**
 * Vérifie si l'utilisateur connecté peut modifier un plan
 * Seuls les ADMIN et SUPER_ADMIN peuvent modifier des plans
 * @param resourceId - ID du plan
 * @returns true si l'accès est autorisé
 */
export const canUpdatePlan = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce : seuls les admins peuvent modifier des plans (ressource technique)
  if (!userCan(authUser, ActionsConst.UPDATE, SubjectsConst.TECHNICAL)) {
    return false
  }

  // Récupérer le plan pour vérifier qu'il existe
  const plan = await getPlanByIdDao(resourceId)
  if (!plan) return false

  // Permission accordée pour les admins
  return true
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer un plan
 * Seuls les SUPER_ADMIN peuvent supprimer des plans
 * @param resourceId - ID du plan
 * @returns true si l'accès est autorisé
 */
export const canDeletePlan = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce : seuls les super admins peuvent supprimer des plans (ressource technique)
  if (!userCan(authUser, ActionsConst.DELETE, SubjectsConst.TECHNICAL)) {
    return false
  }

  // Récupérer le plan pour vérifier qu'il existe
  const plan = await getPlanByIdDao(resourceId)
  if (!plan) return false

  // Vérifier que le plan n'est pas utilisé par des subscriptions actives
  // TODO: Ajouter vérification des subscriptions actives utilisant ce plan

  // Permission accordée pour les super admins
  return true
}

/**
 * Vérifie si l'utilisateur connecté peut lister les plans
 * Tous les utilisateurs connectés peuvent lister les plans actifs
 * @returns true si l'accès est autorisé
 */
export const canListPlans = async (): Promise<boolean> => {
  return true
}
