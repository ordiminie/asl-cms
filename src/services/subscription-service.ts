import {StripePlan} from '@better-auth/stripe'

import {
  // Plans repositories
  createPlanDao,
  createSubscriptionDao,
  deletePlanDao,
  getActivePlansDao,
  getActiveSubscriptionsByStripeCustomerIdDao,
  getActiveSubscriptionsByUserIdDao,
  getAllActiveSubscriptionsDao,
  getNewSubscriptionsThisMonthDao,
  getPlanByCodeDao,
  getPlanByIdDao,
  getPlanByPriceIdDao,
  getPlansWithPaginationDao,
  getSubscriptionByIdDao,
  getSubscriptionByUserIdDao,
  getSubscriptionGrowthByMonthDao,
  getSubscriptionsWithPaginationDao,
  initSubscriptionDao,
  isActivePlanExistDao,
  isPlanAndStripeSubscriptionExistDao,
  isPlanExistDao,
  isPlanNameExistDao,
  isPriceIdExistDao,
  softDeletePlanDao,
  updatePlanDao,
  updateSubscriptionDao,
} from '@/db/repositories/subscription-repository'
import {
  getUserByEmailDao,
  getUserByIdDao,
  updateUserSafeByUidDao,
} from '@/db/repositories/user-repository'
import {BILLING_MODE} from '@/lib/helper/subscription-helper'
import {logger} from '@/lib/logger'
import {getSubscriptionDetails} from '@/lib/stripe/stripe-utils'
import {
  canCreatePlan,
  canDeletePlan,
  canListPlans,
  // Plans authorizations
  canReadPlan,
  canReadSubscription,
  canUpdatePlan,
  canUpdateSubscription,
} from '@/services/authorization/subscription-authorization'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  BillingModes,
  // Plans types
  type CreatePlan,
  type CreateSubscription,
  type LimitType,
  LimitTypeConst,
  type MRRStats,
  type Plan,
  PlanConst,
  type PlanDTO,
  type PlanFreeTrial,
  type PlanLimits,
  type Subscription,
  type SubscriptionPlan,
  type UpdatePlan,
  type UpdateSubscription,
} from '@/services/types/domain/subscription-types'
import {
  // Plans validation schemas
  createPlanServiceSchema,
  createSubscriptionServiceSchema,
  planNameSchema,
  planUuidSchema,
  priceIdSchema,
  updatePlanServiceSchema,
  updateSubscriptionServiceSchema,
} from '@/services/validation/subscription-validation'

import {getAuthUser} from './authentication/auth-service'
import {isAuthAdmin} from './authorization/user-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {getUserOrganizationsService} from './organization-service'
import {OrganizationRoleConst} from './types/domain/organization-types'
import {User} from './types/domain/user-types'

export const createSubscriptionService = async (params: CreateSubscription) => {
  const parsed = createSubscriptionServiceSchema.safeParse(params)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const subscription = await createSubscriptionDao(parsed.data)
  return subscription
}

export const getSubscriptionByIdService = async (id: string) => {
  const canRead = await canReadSubscription(id)
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé')
  }

  const subscription = await getSubscriptionByIdDao(id)
  return subscription
}

export const updateSubscriptionService = async (params: UpdateSubscription) => {
  const parsed = updateSubscriptionServiceSchema.safeParse(params)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canUpdate = await canUpdateSubscription(params.id)
  if (!canUpdate) {
    throw new AuthorizationError('Accès non autorisé')
  }

  return updateSubscriptionDao(params.id, parsed.data)
}

export const isPlanExistService = async (
  referenceId: string,
  plan: SubscriptionPlan,
  seats: number,
  checkActiveOnly = true
): Promise<boolean> => {
  try {
    if (checkActiveOnly) {
      return isActivePlanExistDao(referenceId, plan, seats)
    }
    return isPlanExistDao(referenceId, plan, seats)
  } catch (error) {
    console.error('Error checking plan existence:', error)
    throw new Error('Failed to check plan existence')
  }
}

// Simplified for Better Auth - no more dual workflow
export const createSubscriptionFromStripeService = async (
  email: string,
  plan: SubscriptionPlan,
  yearly: boolean = false,
  stripeSubscriptionId?: string,
  stripeCustomerId?: string,
  seats: number = 1,
  endDate?: Date | null
) => {
  const user = await getUserByEmailDao(email)
  if (!user) {
    throw new Error('User not found')
  }

  // Vérifier si l'abonnement existe déjà
  const planExists = await isPlanExistService(user.id, plan, seats, true)
  if (planExists) {
    console.warn('⚠️ User already has an active subscription')
    //throw new Error(`User already has an active ${plan} subscription`)
  }
  const planAndStripeSubscriptionExist =
    await isPlanAndStripeSubscriptionExistDao(
      user.organizations?.[0]?.organizationId || user.id,
      plan
    )
  if (planAndStripeSubscriptionExist) {
    console.warn(
      "⚠️You're already subscribed to a plan with a stripe subscription"
    )
  }

  const currentDate = new Date()
  // let endDate: Date | null = null

  // Better Auth approach: calculate end date based on plan type
  // Lifetime plans don't have end dates, recurring plans do
  if (!endDate && plan !== PlanConst.LIFETIME) {
    endDate = new Date()
    if (yearly) {
      endDate.setFullYear(endDate.getFullYear() + 1)
    } else {
      endDate.setMonth(endDate.getMonth() + 1)
    }
  }

  if (!user.stripeCustomerId) {
    await updateUserSafeByUidDao(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        stripeCustomerId: stripeCustomerId || user.stripeCustomerId,
      },
      user.id
    )
  }

  const subscription = await createSubscriptionDao({
    referenceId: user.id,
    plan,
    status: 'active',
    periodStart: currentDate,
    periodEnd: endDate,
    stripeCustomerId: stripeCustomerId || user.stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId || '',
    seats,
  })

  return subscription
}

export const getSubscriptionByUserIdService = async (userId: string) => {
  const user = await getUserByIdDao(userId)
  if (!user) {
    throw new Error('User not found')
  }

  // Utilise referenceId (userId) pour la recherche car c'est l'identifiant Better Auth
  const subscription = await getSubscriptionByUserIdDao(userId)
  return subscription
}

export const getActiveSubscriptionsByUserIdService = async (userId: string) => {
  // Vérifier si l'utilisateur existe
  const user = await getUserByIdDao(userId)
  if (!user) {
    throw new Error('User not found')
  }

  // Utilise referenceId (userId) pour la recherche car c'est l'identifiant Better Auth
  const subscriptions = await getActiveSubscriptionsByUserIdDao(userId)

  if (subscriptions.length === 0) {
    return subscriptions
  }
  // Vérifier les permissions
  const canRead = await canReadSubscription(subscriptions[0].id)

  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé')
  }
  return subscriptions
}

export const getActiveSubscriptionsByUserEmailService = async (
  email: string
) => {
  // Récupérer l'utilisateur par email
  const user = await getUserByEmailDao(email)
  if (!user) {
    throw new Error('User not found')
  }

  // Utiliser le service existant avec l'ID
  return getActiveSubscriptionsByUserIdService(user.id)
}

// Nouvelles fonctions pour les cas où on a besoin d'utiliser stripeCustomerId
export const getActiveSubscriptionsByStripeCustomerIdService = async (
  stripeCustomerId: string
) => {
  const subscriptions =
    await getActiveSubscriptionsByStripeCustomerIdDao(stripeCustomerId)
  return subscriptions
}

export const initSubscriptionService = async (params: {
  plan: SubscriptionPlan
  seats: number
  referenceId?: string
  stripeCustomerId?: string
}): Promise<string> => {
  // Validation des paramètres
  if (!params.plan) {
    throw new ValidationError('Plan is required')
  }
  if (!params.seats || params.seats < 1) {
    throw new ValidationError('Seats must be at least 1')
  }
  if (params.referenceId) {
    const planExists = await isPlanExistService(
      params.referenceId,
      params.plan,
      params.seats,
      true
    )

    if (planExists) {
      throw new ValidationError("You're already subscribed to this plan")
    }
    // Vérifier si l'utilisateur a déjà un abonnement avec ce stripe subscription
    // on veut eviter decraser une soucription si elle na pas etait cancel dans stripe portal
    const planAndStripeSubscriptionExist =
      await isPlanAndStripeSubscriptionExistDao(params.referenceId, params.plan)
    if (planAndStripeSubscriptionExist) {
      throw new ValidationError(
        "You're already subscribed to a plan with a stripe subscription"
      )
    }
  }

  let existingSubscription
  if (params.referenceId) {
    const subscriptions = await getSubscriptionByUserIdDao(params.referenceId)
    existingSubscription = subscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    )
  }
  if (existingSubscription) {
    return existingSubscription.id
  }
  // Créer la subscription en statut 'incomplete'
  const subscriptionId = await initSubscriptionDao(params)

  return subscriptionId
}

/**
 * Service spécialisé pour la mise à jour des subscriptions depuis les webhooks
 * Pas de vérification d'autorisation car les webhooks sont des sources trusted
 */
export const updateSubscriptionForWebhookService = async (params: {
  subscriptionId: string
  referenceId: string
  stripeCustomerId?: string
}): Promise<Subscription> => {
  // Validation simple des paramètres
  if (!params.subscriptionId) {
    throw new ValidationError('SubscriptionId is required')
  }
  if (!params.referenceId) {
    throw new ValidationError('ReferenceId is required')
  }

  // Vérifier que la subscription existe
  const existingSubscription = await getSubscriptionByIdDao(
    params.subscriptionId
  )
  if (!existingSubscription) {
    throw new ValidationError(
      `Subscription with id ${params.subscriptionId} not found`
    )
  }

  // Préparation des données à mettre à jour
  const updateData: Partial<Parameters<typeof updateSubscriptionDao>[1]> = {
    referenceId: params.referenceId,
  }

  // Ajouter stripeCustomerId si fourni
  if (params.stripeCustomerId) {
    updateData.stripeCustomerId = params.stripeCustomerId
  }

  // Mise à jour directe sans autorisation (webhook trusted)
  const updatedSubscription = await updateSubscriptionDao(
    params.subscriptionId,
    updateData
  )

  if (!updatedSubscription) {
    throw new Error('Failed to update subscription')
  }

  return updatedSubscription
}

/**
 * 🎯 Détermine le referenceId pour les subscriptions selon le mode de facturation
 */
export async function getBillingReferenceId(
  userId?: string,
  organizationId?: string
): Promise<string> {
  // Si organizationId explicite fourni, l'utiliser en mode organization
  if (organizationId && BILLING_MODE === BillingModes.ORGANIZATION) {
    return organizationId
  }

  // Mode USER : utilise toujours l'userId
  if (BILLING_MODE === BillingModes.USER) {
    const user = userId ? {id: userId} : await getAuthUser()
    if (!user?.id) {
      throw new Error('User ID required for user billing mode')
    }
    return user.id
  }

  // Mode ORGANIZATION : récupère l'org par défaut de l'user
  if (BILLING_MODE === BillingModes.ORGANIZATION) {
    const user = userId ? {id: userId} : await getAuthUser()
    if (!user?.id) {
      throw new Error('User ID required to get organization')
    }

    // Récupérer la première organisation de l'utilisateur (ou celle créée automatiquement)
    const organizations = await getUserOrganizationsService(user.id)
    const defaultOrg =
      organizations.find((org) => org.role === OrganizationRoleConst.owner) ||
      organizations[0] // Cherche d'abord le rôle owner, sinon prend la première org

    if (!defaultOrg) {
      console.warn(
        'No organization found for user : referenceId is user.id',
        user.id
      )
      return user.id
    }

    return defaultOrg.organizationId
  }

  throw new Error(`Invalid billing mode: ${BILLING_MODE}`)
}

/**
 * 🏢 Récupère le contexte de facturation complet
 */
export async function getBillingContext(
  userId?: string,
  organizationId?: string
) {
  const referenceId = await getBillingReferenceId(userId, organizationId)

  return {
    referenceId,
    billingMode: BILLING_MODE,
    isUserBilling: BILLING_MODE === BillingModes.USER,
    isOrganizationBilling: BILLING_MODE === BillingModes.ORGANIZATION,
  }
}

/**
 * 🎫 Validation des permissions pour la gestion de subscription
 */
export async function canManageSubscription(
  referenceId: string,
  user?: User
): Promise<boolean> {
  const authUser = user || (await getAuthUser())
  if (!authUser?.id) return false

  // Mode USER : seul le propriétaire peut gérer
  if (BILLING_MODE === BillingModes.USER) {
    return authUser.id === referenceId
  }

  // Mode ORGANIZATION : vérifier les permissions dans l'org
  if (BILLING_MODE === BillingModes.ORGANIZATION) {
    const organizations = await getUserOrganizationsService(authUser.id)
    const userOrg = organizations.find(
      (org) => org.organizationId === referenceId
    )

    // User doit être OWNER ou ADMIN pour gérer les subscriptions
    return userOrg?.role === 'owner' || userOrg?.role === 'admin'
  }

  return false
}

/**
 * 📊 Helper pour affichage UI
 */
export function getBillingDisplayInfo() {
  return {
    mode: BILLING_MODE,
    isUserBilling: BILLING_MODE === BillingModes.USER,
    isOrganizationBilling: BILLING_MODE === BillingModes.ORGANIZATION,
    billingEntity:
      BILLING_MODE === BillingModes.USER ? 'utilisateur' : 'organisation',
    seatLabel: BILLING_MODE === BillingModes.USER ? 'utilisateur' : 'membres',
  }
}

export type SubscriptionLimit = {
  allowed: boolean
  limit: number
  usage: number
  remaining: number
  hasSubscription: boolean
  limitType: LimitType
  plan: string
}

export const perSeatMultiplier = false //todo env

/**
 * 🎯 Vérification générique des limites d'abonnement (logique métier pure)
 */
export const checkSubscriptionLimitService = async (
  subscription: {
    limits?: Record<string, number>
    seats?: number
    plan?: string
  } | null,
  limitType: LimitType,
  currentUsage: number,
  requestedAmount: number = 1
): Promise<SubscriptionLimit> => {
  if (!subscription) {
    logger.warn('[checkSubscriptionLimitService] no subscription')
    const freeStripePlan = await getPlanByCodeService(PlanConst.FREE)
    return {
      allowed: false,
      limit: 0,
      usage: currentUsage,
      remaining: 0,
      hasSubscription: false,
      limitType,
      plan: freeStripePlan?.code as string,
    }
  }

  // 🎯 Logique spécifique selon le type de limite
  let effectiveLimit: number

  if (limitType === LimitTypeConst.USERS) {
    // Pour les utilisateurs : utiliser le nombre de sièges
    effectiveLimit = subscription.seats || 0
  } else {
    // Pour les autres ressources : utiliser la limite fixe du plan
    if (perSeatMultiplier) {
      //si les limites sont multiplier par nombres de seat
      effectiveLimit =
        (subscription.limits?.[limitType] || 1) * (subscription.seats || 1)
    } else {
      effectiveLimit = subscription.limits?.[limitType] || 0
    }
  }

  const remaining = Math.max(0, effectiveLimit - currentUsage)

  if (remaining === 0) {
    const isAdmin = await isAuthAdmin()
    if (isAdmin) {
      logger.info('remaining is 0 but user is admin, returning max limit')
      return {
        allowed: true,
        limit: 1000000,
        usage: currentUsage,
        remaining: 1000000,
        hasSubscription: true,
        limitType,
        plan: subscription.plan || '',
      }
    }
  }

  return {
    allowed: currentUsage + requestedAmount <= effectiveLimit,
    limit: effectiveLimit,
    usage: currentUsage,
    remaining,
    hasSubscription: true,
    limitType,
    plan: subscription.plan || '',
  }
}

// ========================================
// SERVICES POUR LES PLANS
// ========================================

/**
 * Créer un nouveau plan
 */
export const createPlanService = async (params: CreatePlan): Promise<Plan> => {
  // 1. Validation des paramètres
  const parsed = createPlanServiceSchema.safeParse(params)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canCreate = await canCreatePlan()
  if (!canCreate) {
    throw new AuthorizationError('Accès non autorisé pour créer un plan')
  }

  // 3. Vérification des contraintes métier
  const nameExists = await isPlanNameExistDao(parsed.data.code)
  if (nameExists) {
    throw new ValidationError(
      `Un plan avec le nom "${parsed.data.code}" existe déjà`
    )
  }

  const priceIdExists = await isPriceIdExistDao(parsed.data.priceId)
  if (priceIdExists) {
    throw new ValidationError(
      `Un plan avec le priceId "${parsed.data.priceId}" existe déjà`
    )
  }

  // 4. Vérification du priceId annuel s'il est fourni
  if (parsed.data.annualDiscountPriceId) {
    const annualPriceIdExists = await isPriceIdExistDao(
      parsed.data.annualDiscountPriceId
    )
    if (annualPriceIdExists) {
      throw new ValidationError(
        `Un plan avec le priceId annuel "${parsed.data.annualDiscountPriceId}" existe déjà`
      )
    }
  }

  // 5. Création du plan
  const plan = await createPlanDao(parsed.data)
  return plan
}

/**
 * Obtenir un plan par ID
 */
export const getPlanByIdService = async (
  id: string
): Promise<Plan | undefined> => {
  // 1. Validation de l'ID
  const parsed = planUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canRead = await canReadPlan(id)
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé pour lire ce plan')
  }

  // 3. Récupération du plan
  const plan = await getPlanByIdDao(id)
  return plan
}

/**
 * Obtenir un plan par nom
 */
export const getPlanByCodeService = async (
  code: string
): Promise<Plan | undefined> => {
  // 1. Validation du nom
  const parsed = planNameSchema.safeParse(code)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canRead = await canReadPlan()
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé pour lire les plans')
  }

  // 3. Récupération du plan
  const plan = await getPlanByCodeDao(code)
  return plan
}

export const getPlanByPriceIdService = async (
  priceId: string
): Promise<Plan | undefined> => {
  const parsed = priceIdSchema.safeParse(priceId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canRead = await canReadPlan()
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé pour lire les plans')
  }

  const plan = await getPlanByPriceIdDao(priceId)
  return plan
}

/**
 * Obtenir un plan par priceId (version publique sans autorisation)
 */
export const getPlanByPriceIdPublicService = async (
  priceId: string
): Promise<PlanDTO | undefined> => {
  const parsed = priceIdSchema.safeParse(priceId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const plan = await getPlanByPriceIdDao(priceId)

  if (!plan) {
    return undefined
  }

  // Transformer en DTO public (sans champs techniques)
  const publicPlan: PlanDTO = {
    id: plan.id,
    code: plan.code,
    planName: plan.planName,
    priceId: plan.priceId,
    annualDiscountPriceId: plan.annualDiscountPriceId || undefined,
    limits: plan.limits as PlanLimits,
    freeTrial: plan.freeTrial as PlanFreeTrial,
    features: plan.features as unknown[],
    description: plan.description || undefined,
    price: plan.price || undefined,
    yearlyPrice: plan.yearlyPrice || undefined,
    currency: plan.currency,
    isRecurring: plan.isRecurring,
    status: plan.status,
    displayOrder: plan.displayOrder,
    name: plan.planName,
  }

  return publicPlan
}

/**
 * Obtenir un plan par code (version publique sans autorisation)
 */
export const getPlanByCodePublicService = async (
  code: string
): Promise<PlanDTO | undefined> => {
  const parsed = planNameSchema.safeParse(code)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const plan = await getPlanByCodeDao(code)

  if (!plan) {
    return undefined
  }

  // Transformer en DTO public (sans champs techniques)
  const publicPlan: PlanDTO = {
    id: plan.id,
    code: plan.code,
    planName: plan.planName,
    priceId: plan.priceId,
    annualDiscountPriceId: plan.annualDiscountPriceId || undefined,
    limits: plan.limits as PlanLimits,
    freeTrial: plan.freeTrial as PlanFreeTrial,
    features: plan.features as unknown[],
    description: plan.description || undefined,
    price: plan.price || undefined,
    yearlyPrice: plan.yearlyPrice || undefined,
    currency: plan.currency,
    isRecurring: plan.isRecurring,
    status: plan.status,
    displayOrder: plan.displayOrder,
    name: plan.planName,
  }

  return publicPlan
}

/**
 * Obtenir tous les plans actifs
 */
export const getActivePlansService = async (): Promise<Plan[]> => {
  // 1. Vérification des autorisations
  const canList = await canListPlans()
  if (!canList) {
    throw new AuthorizationError('Accès non autorisé pour lister les plans')
  }

  // 2. Récupération des plans actifs
  const plans = await getActivePlansDao()
  return plans
}

/**
 * Obtenir tous les plans avec pagination
 */
export const getPlansWithPaginationService = async (
  pagination: Pagination,
  search?: string
): Promise<PaginatedResponse<Plan>> => {
  // 1. Vérification des autorisations
  const canList = await canListPlans()
  if (!canList) {
    throw new AuthorizationError('Accès non autorisé pour lister les plans')
  }

  // 2. Récupération des plans avec pagination et recherche
  const paginatedPlans = await getPlansWithPaginationDao(pagination, search)
  return paginatedPlans
}

/**
 * Mettre à jour un plan
 */
export const updatePlanService = async (params: UpdatePlan): Promise<Plan> => {
  // 1. Validation des paramètres
  const parsed = updatePlanServiceSchema.safeParse(params)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canUpdate = await canUpdatePlan(params.id)
  if (!canUpdate) {
    throw new AuthorizationError('Accès non autorisé pour modifier ce plan')
  }

  // 3. Vérification des contraintes métier
  if (parsed.data.name) {
    const nameExists = await isPlanNameExistDao(parsed.data.name)
    if (nameExists) {
      // Vérifier que ce n'est pas le même plan
      const existingPlan = await getPlanByCodeDao(parsed.data.name)
      if (existingPlan && existingPlan.id !== params.id) {
        throw new ValidationError(
          `Un autre plan avec le nom "${parsed.data.name}" existe déjà`
        )
      }
    }
  }

  if (parsed.data.priceId) {
    const priceIdExists = await isPriceIdExistDao(parsed.data.priceId)
    if (priceIdExists) {
      // Vérifier que ce n'est pas le même plan
      const existingPlan = await getPlanByPriceIdDao(parsed.data.priceId)
      if (existingPlan && existingPlan.id !== params.id) {
        throw new ValidationError(
          `Un autre plan avec le priceId "${parsed.data.priceId}" existe déjà`
        )
      }
    }
  }

  if (parsed.data.annualDiscountPriceId) {
    const annualPriceIdExists = await isPriceIdExistDao(
      parsed.data.annualDiscountPriceId
    )
    if (annualPriceIdExists) {
      // Vérifier que ce n'est pas le même plan
      const existingPlan = await getPlanByPriceIdDao(
        parsed.data.annualDiscountPriceId
      )
      if (existingPlan && existingPlan.id !== params.id) {
        throw new ValidationError(
          `Un autre plan avec le priceId annuel "${parsed.data.annualDiscountPriceId}" existe déjà`
        )
      }
    }
  }

  // 4. Mise à jour du plan
  const updatedPlan = await updatePlanDao(params.id, parsed.data)
  return updatedPlan
}

/**
 * Supprimer un plan (soft delete)
 */
export const softDeletePlanService = async (id: string): Promise<void> => {
  // 1. Validation de l'ID
  const parsed = planUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canDelete = await canDeletePlan(id)
  if (!canDelete) {
    throw new AuthorizationError('Accès non autorisé pour supprimer ce plan')
  }

  // 3. Vérification que le plan existe
  const plan = await getPlanByIdDao(id)
  if (!plan) {
    throw new ValidationError('Plan non trouvé')
  }

  // 4. TODO: Vérifier qu'aucune subscription active n'utilise ce plan
  // const activeSubscriptions = await getActiveSubscriptionsByPlanDao(id)
  // if (activeSubscriptions.length > 0) {
  //   throw new ValidationError('Impossible de supprimer un plan utilisé par des subscriptions actives')
  // }

  // 5. Suppression soft du plan
  await softDeletePlanDao(id)
}

/**
 * Supprimer définitivement un plan
 */
export const deletePlanService = async (id: string): Promise<void> => {
  // 1. Validation de l'ID
  const parsed = planUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canDelete = await canDeletePlan(id)
  if (!canDelete) {
    throw new AuthorizationError(
      'Accès non autorisé pour supprimer définitivement ce plan'
    )
  }

  // 3. Vérification que le plan existe
  const plan = await getPlanByIdDao(id)
  if (!plan) {
    throw new ValidationError('Plan non trouvé')
  }

  // 4. TODO: Vérifier qu'aucune subscription n'utilise ce plan
  // const subscriptions = await getSubscriptionsByPlanDao(id)
  // if (subscriptions.length > 0) {
  //   throw new ValidationError('Impossible de supprimer définitivement un plan utilisé par des subscriptions')
  // }

  // 5. Suppression définitive du plan
  await deletePlanDao(id)
}

/**
 * Vérifier si un nom de plan existe
 */
export const isPlanNameExistService = async (
  name: string
): Promise<boolean> => {
  // 1. Validation du nom
  const parsed = planNameSchema.safeParse(name)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canRead = await canReadPlan()
  if (!canRead) {
    throw new AuthorizationError(
      "Accès non autorisé pour vérifier l'existence des plans"
    )
  }

  // 3. Vérification de l'existence
  const exists = await isPlanNameExistDao(name)
  return exists
}

/**
 * Vérifier si un priceId existe
 */
export const isPriceIdExistService = async (
  priceId: string
): Promise<boolean> => {
  // 1. Validation du priceId
  const parsed = priceIdSchema.safeParse(priceId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // 2. Vérification des autorisations
  const canRead = await canReadPlan()
  if (!canRead) {
    throw new AuthorizationError(
      "Accès non autorisé pour vérifier l'existence des plans"
    )
  }

  // 3. Vérification de l'existence
  const exists = await isPriceIdExistDao(priceId)
  return exists
}

/**
 * Obtenir tous les plans actifs au format StripePlan[] pour Better Auth
 */
export const getActivePlansForBetterAuthService = async (): Promise<
  StripePlan[]
> => {
  // 1. Récupération des plans actifs
  const plans = await getActivePlansDao()

  // 2. Transformation en format StripePlan pour Better Auth
  const stripePlans: StripePlan[] = plans.map((plan) => ({
    name: plan.code as SubscriptionPlan,
    priceId: plan.priceId,
    annualDiscountPriceId: plan.annualDiscountPriceId ?? undefined,
    limits: plan.limits as Record<string, number>,
    freeTrial: plan.freeTrial as {days: number} | undefined,
  }))

  return stripePlans
}

export const isYearlyPriceService = async (
  priceId?: string
): Promise<boolean> => {
  if (!priceId) {
    return false
  }
  const plans = await getActivePlansDao()
  return plans.some((plan) => plan.annualDiscountPriceId === priceId)
}

// ========================================
// SERVICES POUR LES SUBSCRIPTIONS ADMIN
// ========================================

/**
 * Obtenir toutes les subscriptions avec pagination pour l'admin
 */
export const getSubscriptionsWithPaginationService = async (
  pagination: Pagination,
  search?: string
): Promise<PaginatedResponse<Subscription>> => {
  // 1. Vérification des autorisations admin
  const canList = await canReadSubscription() // Réutilise l'autorisation des plans pour l'admin
  if (!canList) {
    throw new AuthorizationError(
      'Accès non autorisé pour lister les subscriptions'
    )
  }

  // 2. Récupération des subscriptions avec pagination et recherche
  const paginatedSubscriptions = await getSubscriptionsWithPaginationDao(
    pagination,
    search
  )
  return paginatedSubscriptions
}

/**
 * Annuler une subscription (action admin)
 */
export const cancelSubscriptionAdminService = async (
  subscriptionId: string
): Promise<void> => {
  // 1. Vérification des autorisations admin
  const canManage = await canUpdateSubscription(subscriptionId)
  if (!canManage) {
    throw new AuthorizationError(
      'Accès non autorisé pour gérer les subscriptions'
    )
  }

  // 2. Vérifier que la subscription existe
  const subscription = await getSubscriptionByIdDao(subscriptionId)
  if (!subscription) {
    throw new ValidationError('Subscription non trouvée')
  }

  // 3. Mettre à jour le statut
  await updateSubscriptionDao(subscriptionId, {
    status: 'canceled',
    cancelAtPeriodEnd: true,
  })
}

/**
 * Réactiver une subscription (action admin)
 */
export const reactivateSubscriptionAdminService = async (
  subscriptionId: string
): Promise<void> => {
  // 1. Vérification des autorisations admin
  const canManage = await canUpdateSubscription(subscriptionId)
  if (!canManage) {
    throw new AuthorizationError(
      'Accès non autorisé pour gérer les subscriptions'
    )
  }

  // 2. Vérifier que la subscription existe
  const subscription = await getSubscriptionByIdDao(subscriptionId)
  if (!subscription) {
    throw new ValidationError('Subscription non trouvée')
  }

  // 3. Réactiver la subscription
  await updateSubscriptionDao(subscriptionId, {
    status: 'active',
    cancelAtPeriodEnd: false,
  })
}

// ========================================
// SERVICES POUR LES STATISTIQUES MRR
// ========================================

/**
 * Obtenir toutes les statistiques MRR pour le dashboard admin
 */
export const getAdminStripeSubscriptionMRRService =
  async (): Promise<MRRStats> => {
    // 1. Vérification des autorisations admin
    const canList = await canReadSubscription()
    if (!canList) {
      throw new AuthorizationError(
        'Accès non autorisé pour consulter les statistiques MRR'
      )
    }

    // 2. Récupérer toutes les subscriptions actives, nouvelles du mois et croissance
    const [subscriptions, newSubscriptionsThisMonth, subscriptionGrowth] =
      await Promise.all([
        getAllActiveSubscriptionsDao(),
        getNewSubscriptionsThisMonthDao(),
        getSubscriptionGrowthByMonthDao(),
      ])

    // 3. Pour chaque subscription, récupérer les détails Stripe
    const subscriptionDetails = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        if (!sub.stripeSubscriptionId) return null

        try {
          const stripeDetails = await getSubscriptionDetails(
            sub.stripeSubscriptionId
          )
          if (!stripeDetails) return null

          // Récupérer les infos du plan
          const plan = await getPlanByCodeDao(sub.plan)

          return {
            subscriptionId: sub.id,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            planName: plan?.planName || sub.plan,
            planCode: sub.plan,
            amount: stripeDetails.items.data[0]?.price.unit_amount || 0,
            currency: stripeDetails.items.data[0]?.price.currency || 'eur',
            quantity: stripeDetails.items.data[0]?.quantity || 1,
            status: stripeDetails.status,
            interval: stripeDetails.items.data[0]?.price.recurring?.interval as
              | 'month'
              | 'year',
            intervalCount:
              stripeDetails.items.data[0]?.price.recurring?.interval_count || 1,
            currentPeriodStart: new Date(sub.periodStart || 0),
            currentPeriodEnd: new Date(sub.periodEnd || 0),
            createdAt: sub.createdAt || new Date(),
            referenceId: sub.referenceId,
          }
        } catch (error) {
          logger.error('Erreur récupération détails Stripe:', {
            subscriptionId: sub.id,
            error,
          })
          return null
        }
      })
    )

    // 4. Filtrer les résultats valides
    const validSubscriptions = subscriptionDetails
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter(Boolean)

    // 5. Calculer les statistiques
    let totalMRR = 0
    let monthlyMRR = 0
    let yearlyMRR = 0
    const planBreakdowns = new Map<
      string,
      {
        planCode: string
        planName: string
        subscriptionCount: number
        totalMRR: number
        currency: string
        amounts: number[]
      }
    >()

    validSubscriptions.forEach((sub) => {
      // Calculer MRR (montant mensuel récurrent)
      const unitAmount = sub?.amount || 0
      const quantity = sub?.quantity || 0
      let monthlyAmount = unitAmount * quantity

      if (sub?.interval === 'year') {
        monthlyAmount = Math.round(monthlyAmount / 12) // Diviser par 12 pour avoir le MRR
        yearlyMRR += monthlyAmount
      } else {
        monthlyMRR += monthlyAmount
      }

      totalMRR += monthlyAmount

      // Calculer breakdown par plan
      const planKey = sub?.planCode || 'free'
      if (!planBreakdowns.has(planKey)) {
        planBreakdowns.set(planKey, {
          planCode: sub?.planCode || 'free',
          planName: sub?.planName || 'free',
          subscriptionCount: 0,
          totalMRR: 0,
          currency: sub?.currency || 'eur',
          amounts: [],
        })
      }

      const breakdown = planBreakdowns.get(planKey)
      if (breakdown) {
        breakdown.subscriptionCount++
        breakdown.totalMRR += monthlyAmount
        breakdown.amounts.push(monthlyAmount)
      }
    })

    // 6. Calculer les moyennes et formater les résultats
    const planBreakdownsArray = Array.from(planBreakdowns.values()).map(
      (breakdown) => ({
        planCode: breakdown.planCode,
        planName: breakdown.planName,
        subscriptionCount: breakdown.subscriptionCount,
        totalMRR: breakdown.totalMRR,
        averageAmount: Math.round(
          breakdown.totalMRR / breakdown.subscriptionCount
        ),
        currency: breakdown.currency,
      })
    )

    const averageRevenuePerUser =
      validSubscriptions.length > 0
        ? Math.round(totalMRR / validSubscriptions.length)
        : 0

    // 7. Calculer la croissance des subscriptions
    const totalSubs = validSubscriptions.length
    const newSubsCount = newSubscriptionsThisMonth.length
    const subscriptionGrowthPercent =
      totalSubs > 0 ? Math.round((newSubsCount / totalSubs) * 100) : 0

    return {
      totalMRR,
      currency: validSubscriptions[0]?.currency || 'eur',
      totalActiveSubscriptions: validSubscriptions.length,
      newSubscriptionsThisMonth: newSubsCount,
      subscriptionGrowthPercent,
      subscriptionGrowth: subscriptionGrowth as {
        month: string
        count: number
      }[],
      planBreakdowns: planBreakdownsArray,
      monthlyMRR,
      yearlyMRR,
      averageRevenuePerUser,
    }
  }
