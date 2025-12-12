import {and, desc, eq, not, or, sql} from 'drizzle-orm'

import {PaginatedResponse, Pagination} from '@/services/types/common-type'

import {member} from '../models/auth-model'
import db from '../models/db'
import {projects} from '../models/project-model'
import type {
  SubscriptionAddModel,
  SubscriptionModel,
  SubscriptionPlanAddModel,
  SubscriptionPlanModel,
} from '../models/subscription-model'
import {subscription, subscriptionPlan} from '../models/subscription-model'

export const createSubscriptionDao = async (values: SubscriptionAddModel) => {
  const [row] = await db.insert(subscription).values(values).returning()
  return row
}

export const getSubscriptionByIdDao = async (id: string) => {
  const [row] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.id, id))
  return row
}

export const updateSubscriptionDao = async (
  id: string,
  values: Partial<SubscriptionAddModel>
) => {
  const [row] = await db
    .update(subscription)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, id))
    .returning()
  return row
}

export const isPlanExistDao = async (
  referenceId: string,
  plan: SubscriptionModel['plan'],
  seats: number
): Promise<boolean> => {
  const [row] = await db
    .select({id: subscription.id})
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, referenceId),
        eq(subscription.plan, plan),
        eq(subscription.seats, seats)
      )
    )
    .limit(1)

  return Boolean(row)
}

export const isPlanAndStripeSubscriptionExistDao = async (
  referenceId: string,
  plan: SubscriptionModel['plan']
): Promise<boolean> => {
  const [row] = await db
    .select({id: subscription.id})
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, referenceId),
        eq(subscription.plan, plan),

        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        ),
        not(eq(subscription.stripeSubscriptionId, ''))
      )
    )
    .limit(1)

  return Boolean(row)
}

export const isActivePlanExistDao = async (
  referenceId: string,
  plan: SubscriptionModel['plan'],
  seats: number
): Promise<boolean> => {
  const [row] = await db
    .select({id: subscription.id})
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, referenceId),
        eq(subscription.plan, plan),
        eq(subscription.seats, seats),
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        )
      )
    )
    .limit(1)

  return Boolean(row)
}

export const getActiveSubscriptionsByStripeCustomerIdDao = async (
  stripeCustomerId: string
) => {
  const rows = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.stripeCustomerId, stripeCustomerId),
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        )
      )
    )
    .orderBy(desc(subscription.createdAt))

  return rows
}

// Fonctions de commodité qui utilisent userId (referenceId) au lieu de stripeCustomerId
export const getSubscriptionByUserIdDao = async (userId: string) => {
  const row = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, userId))
  return row
}

export const getActiveSubscriptionsByUserIdDao = async (userId: string) => {
  const rows = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, userId),
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        )
      )
    )
    .orderBy(desc(subscription.createdAt))

  return rows
}

export const initSubscriptionDao = async (params: {
  plan: SubscriptionModel['plan']
  seats: number
  referenceId?: string
  stripeCustomerId?: string
}): Promise<string> => {
  const [row] = await db
    .insert(subscription)
    .values({
      plan: params.plan,
      seats: params.seats,
      referenceId: params.referenceId || 'guest', // Guest mode si pas d'utilisateur
      stripeCustomerId: params.stripeCustomerId,
      status: 'incomplete',
      periodStart: new Date(),
      // periodEnd laissé undefined (sera rempli après paiement)
      // stripeSubscriptionId laissé undefined (sera rempli par webhook)
    })
    .returning({id: subscription.id})

  return row.id
}

// ========================================
// CRUD Repository pour les Plans
// ========================================

/**
 * Créer un nouveau plan
 */
export const createPlanDao = async (
  values: SubscriptionPlanAddModel
): Promise<SubscriptionPlanModel> => {
  const [row] = await db.insert(subscriptionPlan).values(values).returning()
  return row
}

/**
 * Obtenir un plan par ID
 */
export const getPlanByIdDao = async (
  id: string
): Promise<SubscriptionPlanModel | undefined> => {
  const row = await db.query.subscriptionPlan.findFirst({
    where: (plan, {eq}) => eq(plan.id, id),
  })
  return row
}

/**
 * Obtenir un plan par nom (name)
 */
export const getPlanByCodeDao = async (
  name: string
): Promise<SubscriptionPlanModel | undefined> => {
  const row = await db.query.subscriptionPlan.findFirst({
    where: (plan, {eq}) => eq(plan.code, name),
  })
  return row
}

/**
 * Obtenir un plan par priceId
 */
export const getPlanByPriceIdDao = async (
  priceId: string
): Promise<SubscriptionPlanModel | undefined> => {
  const row = await db.query.subscriptionPlan.findFirst({
    where: (plan, {eq, or}) =>
      or(eq(plan.priceId, priceId), eq(plan.annualDiscountPriceId, priceId)),
  })
  return row
}

/**
 * Obtenir tous les plans actifs
 */
export const getActivePlansDao = async (): Promise<SubscriptionPlanModel[]> => {
  const rows = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.status, 'active'))
    .orderBy(subscriptionPlan.displayOrder)

  return rows
}

/**
 * Obtenir tous les plans avec pagination
 */
export const getPlansWithPaginationDao = async (
  pagination: Pagination,
  search?: string
): Promise<PaginatedResponse<SubscriptionPlanModel>> => {
  // Construire la clause WHERE pour la recherche
  let searchCondition = undefined
  if (search && search.trim()) {
    const searchTerm = search.trim()
    searchCondition = or(
      sql`${subscriptionPlan.planName} ILIKE ${`%${searchTerm}%`}`,
      sql`${subscriptionPlan.code} ILIKE ${`%${searchTerm}%`}`,
      sql`${subscriptionPlan.description} ILIKE ${`%${searchTerm}%`}`
    )
  }

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(subscriptionPlan)
      .where(searchCondition)
      .orderBy(subscriptionPlan.displayOrder)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({count: sql<number>`count(*)`})
      .from(subscriptionPlan)
      .where(searchCondition),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

/**
 * Mettre à jour un plan
 */
export const updatePlanDao = async (
  id: string,
  values: Partial<SubscriptionPlanAddModel>
): Promise<SubscriptionPlanModel> => {
  const [row] = await db
    .update(subscriptionPlan)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionPlan.id, id))
    .returning()

  return row
}

/**
 * Supprimer un plan (soft delete en passant le statut à 'deprecated')
 */
export const softDeletePlanDao = async (id: string): Promise<void> => {
  await db
    .update(subscriptionPlan)
    .set({
      status: 'deprecated',
      updatedAt: new Date(),
    })
    .where(eq(subscriptionPlan.id, id))
}

/**
 * Supprimer définitivement un plan
 */
export const deletePlanDao = async (id: string): Promise<void> => {
  await db.delete(subscriptionPlan).where(eq(subscriptionPlan.id, id))
}

/**
 * Vérifier si un plan existe par nom
 */
export const isPlanNameExistDao = async (name: string): Promise<boolean> => {
  const [row] = await db
    .select({id: subscriptionPlan.id})
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.code, name))
    .limit(1)

  return Boolean(row)
}

/**
 * Vérifier si un priceId existe déjà
 */
export const isPriceIdExistDao = async (priceId: string): Promise<boolean> => {
  const [row] = await db
    .select({id: subscriptionPlan.id})
    .from(subscriptionPlan)
    .where(
      or(
        eq(subscriptionPlan.priceId, priceId),
        eq(subscriptionPlan.annualDiscountPriceId, priceId)
      )
    )
    .limit(1)

  return Boolean(row)
}

/**
 * Obtenir toutes les subscriptions actives pour les calculs MRR
 */
export const getAllActiveSubscriptionsDao = async () => {
  const rows = await db
    .select()
    .from(subscription)
    .where(
      and(
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        ),
        not(eq(subscription.stripeSubscriptionId, ''))
      )
    )
    .orderBy(desc(subscription.createdAt))

  return rows
}

/**
 * Obtenir les nouvelles subscriptions du mois en cours
 */
export const getNewSubscriptionsThisMonthDao = async () => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  )

  const rows = await db
    .select()
    .from(subscription)
    .where(
      and(
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        ),
        sql`${subscription.createdAt} >= ${startOfMonth}`,
        sql`${subscription.createdAt} <= ${endOfMonth}`
      )
    )
    .orderBy(desc(subscription.createdAt))

  return rows
}

/**
 * Obtenir la croissance des subscriptions par mois (12 derniers mois)
 */
export const getSubscriptionGrowthByMonthDao = async () => {
  const result = await db
    .select({
      month: sql<string>`TO_CHAR(${subscription.createdAt}, 'YYYY-MM')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(subscription)
    .where(
      and(
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        ),
        sql`${subscription.createdAt} >= NOW() - INTERVAL '12 months'`
      )
    )
    .groupBy(sql`TO_CHAR(${subscription.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${subscription.createdAt}, 'YYYY-MM')`)

  return result
}

// ========================================
// FONCTIONS POUR LES SUBSCRIPTIONS ADMIN
// ========================================

/**
 * Obtenir toutes les subscriptions avec pagination pour l'admin
 */
export const getSubscriptionsWithPaginationDao = async (
  pagination: Pagination,
  search?: string
): Promise<PaginatedResponse<SubscriptionModel>> => {
  // Construire la clause WHERE pour la recherche
  let searchCondition = undefined
  if (search && search.trim()) {
    const searchTerm = search.trim()
    // Recherche sur le plan, statut, email utilisateur
    searchCondition = or(
      sql`${subscription.plan} ILIKE ${`%${searchTerm}%`}`,
      sql`${subscription.status} ILIKE ${`%${searchTerm}%`}`,
      sql`${subscription.stripeCustomerId} ILIKE ${`%${searchTerm}%`}`,
      sql`${subscription.referenceId} ILIKE ${`%${searchTerm}%`}`
    )
  }

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(subscription)
      .where(searchCondition)
      .orderBy(desc(subscription.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({count: sql<number>`count(*)`})
      .from(subscription)
      .where(searchCondition),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

// ========================================
// USAGE STATS FUNCTIONS
// ========================================

export interface PlanLimits {
  projects: number | null
  storage: number | null
  users: number | null
}

export interface AdminUsageStats {
  projects: number
  users: number
  plan: string
  limits: PlanLimits
  periodStart: Date | null
  periodEnd: Date | null
}

export const getActiveSubscriptionsOrFreePlanDao = async (
  referenceId: string
) => {
  const subscriptions = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, referenceId),
        or(
          eq(subscription.status, 'active'),
          eq(subscription.status, 'trialing')
        )
      )
    )
    .orderBy(desc(subscription.createdAt))

  if (subscriptions.length === 0) {
    const freePlan = await db.query.subscriptionPlan.findFirst({
      where: (plan, {eq}) => eq(plan.code, 'free'),
    })

    const limits = freePlan?.limits as Record<string, number> | null

    return [
      {
        id: 'free',
        referenceId,
        plan: 'free',
        status: 'active' as const,
        limits: freePlan?.limits as Record<string, number> | null,
        periodStart: null,
        periodEnd: null,
        seats: limits?.users ?? 1,
      },
    ]
  }

  const subsWithLimits = await Promise.all(
    subscriptions.map(async (sub) => {
      const plan = await db.query.subscriptionPlan.findFirst({
        where: (p, {eq}) => eq(p.code, sub.plan),
      })
      return {
        ...sub,
        limits: plan?.limits as Record<string, number> | null,
      }
    })
  )

  return subsWithLimits
}

export const getCurrentProjectsUsageDao = async (
  organizationId: string
): Promise<number> => {
  const [{count}] = await db
    .select({count: sql<number>`count(*)`})
    .from(projects)
    .where(eq(projects.organizationId, organizationId))

  return count
}

export const getCurrentMembersUsageDao = async (
  organizationId: string
): Promise<number> => {
  const [{count}] = await db
    .select({count: sql<number>`count(*)`})
    .from(member)
    .where(eq(member.organizationId, organizationId))

  return count
}

export const getAdminUsageStatsDao = async (
  organizationId: string
): Promise<AdminUsageStats> => {
  const [projectsCount, membersCount] = await Promise.all([
    getCurrentProjectsUsageDao(organizationId),
    getCurrentMembersUsageDao(organizationId),
  ])

  const subscriptions =
    await getActiveSubscriptionsOrFreePlanDao(organizationId)
  const activeSubscription = subscriptions[0]
  const planLimits = activeSubscription?.limits as Record<string, number> | null

  return {
    projects: projectsCount,
    users: membersCount,
    plan: activeSubscription?.plan || 'free',
    limits: {
      projects: planLimits?.projects ?? null,
      storage: planLimits?.storage ?? null,
      users: planLimits?.users ?? null,
    },
    periodStart: activeSubscription?.periodStart || null,
    periodEnd: activeSubscription?.periodEnd || null,
  }
}
