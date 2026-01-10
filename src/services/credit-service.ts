import {
  addPackCreditsTxnDao,
  allocateMonthlyCreditsTxnDao,
  consumeCreditsTxnDao,
  getBalanceDao,
  getDailyUsageDao,
  getRecentActivityDao,
  getUsedThisPeriodDao,
  grantCreditsTxnDao,
  refundCreditsTxnDao,
} from '@/db/repositories/credit-ledger-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {
  getActiveSubscriptionsOrFreePlanDao,
  getPlanByCodeDao,
} from '@/db/repositories/subscription-repository'
import {logger} from '@/lib/logger'
import {stripeClient} from '@/lib/stripe/stripe-client'

import {
  canConsumeCredits,
  canGrantCredits,
  canPurchasePack,
  canReadAllCreditsStats,
  canReadCredits,
} from './authorization/credit-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {
  CreditActivityItem,
  CreditBalanceDetails,
  CreditEntry,
  CreditPackConfig,
  CreditUsageDay,
  GrantCreditsOptions,
  SubscriptionAllocationData,
} from './types/domain/credit-types'
import {
  consumeCreditsServiceSchema,
  getBalanceServiceSchema,
  getRecentActivityServiceSchema,
  getUsageGraphServiceSchema,
  grantCreditsServiceSchema,
  purchasePackServiceSchema,
} from './validation/credit-validation'

// ========================================
// BALANCE & READ OPERATIONS
// ========================================

/**
 * Récupère le solde de crédits d'une organisation
 */
export const getBalanceService = async (
  organizationId: string
): Promise<number> => {
  const parsed = getBalanceServiceSchema.safeParse({organizationId})
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canRead = await canReadCredits(organizationId)
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé aux crédits')
  }

  return getBalanceDao(organizationId)
}

/**
 * Récupère les informations complètes de balance pour l'UI
 */
export const getCreditBalanceService = async (
  organizationId: string
): Promise<CreditBalanceDetails> => {
  const canRead = await canReadCredits(organizationId)
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé aux crédits')
  }

  // Récupérer la subscription active pour les dates de période
  const subscriptions =
    await getActiveSubscriptionsOrFreePlanDao(organizationId)
  const activeSub = subscriptions[0]

  // Lazy allocation (filet de sécurité pour plans annuels)
  // Le mode principal reste event-based via webhook invoice.paid
  // Ceci ne s'active que si aucune allocation n'existe pour la période courante
  if (
    activeSub?.id &&
    activeSub?.plan &&
    activeSub.plan !== 'free' &&
    'stripeSubscriptionId' in activeSub &&
    activeSub.stripeSubscriptionId
  ) {
    try {
      await allocateCreditsOnSubscriptionService({
        id: activeSub.id,
        plan: activeSub.plan,
        referenceId: organizationId,
        stripeSubscriptionId: activeSub.stripeSubscriptionId,
        stripeCustomerId:
          'stripeCustomerId' in activeSub ? activeSub.stripeCustomerId : null,
      })
    } catch (error) {
      logger.warn('Lazy allocation check failed (non-blocking):', error)
    }
  }

  logger.debug('📊 getCreditBalanceService - subscription data:', {
    organizationId,
    hasSub: !!activeSub,
    subPeriodStart: activeSub?.periodStart,
    subPeriodEnd: activeSub?.periodEnd,
    plan: activeSub?.plan,
  })

  // Déterminer les dates de période
  // Toujours utiliser "maintenant" comme fin pour avoir la dernière consommation à droite
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  let periodStart: Date
  const periodEnd: Date = now // Toujours finir à maintenant

  if (activeSub?.periodStart) {
    // Utiliser le plus ancien entre periodStart Stripe et 30 jours ago
    periodStart =
      activeSub.periodStart < thirtyDaysAgo
        ? activeSub.periodStart
        : thirtyDaysAgo
  } else {
    // Fallback: 30 jours glissants
    periodStart = thirtyDaysAgo
  }

  logger.debug('📊 Period dates calculated:', {
    subPeriodStart: activeSub?.periodStart?.toISOString(),
    subPeriodEnd: activeSub?.periodEnd?.toISOString(),
    effectivePeriodStart: periodStart.toISOString(),
    effectivePeriodEnd: periodEnd.toISOString(),
  })

  // Calculer le solde disponible
  const available = await getBalanceDao(organizationId)

  // Calculer l'usage de la période courante
  const usedThisPeriod = await getUsedThisPeriodDao(
    organizationId,
    periodStart,
    periodEnd
  )

  // Récupérer l'allocation mensuelle du plan
  const planLimits = activeSub?.limits as Record<string, number> | null
  const monthlyAllocation = planLimits?.credits ?? 0

  return {
    available,
    balance: available, // Alias pour la compatibilité UI
    usedThisPeriod,
    periodStart,
    periodEnd,
    monthlyAllocation,
  }
}

/**
 * Vérifie si l'organisation peut consommer un montant de crédits
 */
export const canConsumeService = async (
  organizationId: string,
  amount: number
): Promise<boolean> => {
  const balance = await getBalanceDao(organizationId)
  return balance >= amount
}

/**
 * Récupère les données du graphique d'usage quotidien
 */
export const getUsageGraphDataService = async (
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<CreditUsageDay[]> => {
  const parsed = getUsageGraphServiceSchema.safeParse({
    organizationId,
    periodStart,
    periodEnd,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canRead = await canReadCredits(organizationId)
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé aux crédits')
  }

  logger.debug('📊 getUsageGraphDataService - querying:', {
    organizationId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  })

  const data = await getDailyUsageDao(organizationId, periodStart, periodEnd)

  logger.debug('📊 getUsageGraphDataService - result:', {
    rowCount: data.length,
    data,
  })

  return data
}

/**
 * Récupère l'activité récente (timeline)
 */
export const getRecentActivityService = async (
  organizationId: string,
  limit: number = 20
): Promise<CreditActivityItem[]> => {
  const parsed = getRecentActivityServiceSchema.safeParse({
    organizationId,
    limit,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canRead = await canReadCredits(organizationId)
  if (!canRead) {
    throw new AuthorizationError('Accès non autorisé aux crédits')
  }

  return getRecentActivityDao(organizationId, limit)
}

// ========================================
// CONSUME OPERATIONS
// ========================================

/**
 * Consomme des crédits pour une action
 * @throws Error si le solde est insuffisant
 */
export const consumeService = async (
  organizationId: string,
  amount: number,
  reason: string
): Promise<CreditEntry> => {
  const parsed = consumeCreditsServiceSchema.safeParse({
    organizationId,
    amount,
    reason,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canConsume = await canConsumeCredits(organizationId)
  if (!canConsume) {
    throw new AuthorizationError(
      'Accès non autorisé pour consommer des crédits'
    )
  }

  // La vérification du solde est faite dans la transaction DAO
  return consumeCreditsTxnDao(organizationId, amount, reason)
}

/**
 * Rembourse des crédits suite à une erreur système
 * Utilisé quand une opération échoue après avoir consommé des crédits
 */
export const refundCreditsService = async (
  organizationId: string,
  amount: number,
  reason: string
): Promise<CreditEntry> => {
  const parsed = consumeCreditsServiceSchema.safeParse({
    organizationId,
    amount,
    reason,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canConsume = await canConsumeCredits(organizationId)
  if (!canConsume) {
    throw new AuthorizationError(
      'Accès non autorisé pour rembourser des crédits'
    )
  }

  logger.info('Refunding credits', {
    organizationId,
    amount,
    reason,
  })

  return refundCreditsTxnDao({
    organizationId,
    amount,
    reason: `Refund: ${reason}`,
  })
}

// ========================================
// ALLOCATION OPERATIONS
// ========================================

/**
 * Alloue les crédits mensuels lors du renouvellement de subscription
 * Appelé par le webhook Stripe invoice.paid
 */
export const allocateMonthlyCreditsService = async (
  data: SubscriptionAllocationData
): Promise<CreditEntry[]> => {
  // Pas de vérification d'autorisation car appelé par le système (webhook)
  logger.info('Allocating monthly credits', {
    organizationId: data.organizationId,
    monthlyCredits: data.monthlyCredits,
    overrideCredits: data.overrideCredits,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
  })

  return allocateMonthlyCreditsTxnDao({
    organizationId: data.organizationId,
    monthlyCredits: data.monthlyCredits,
    overrideCredits: data.overrideCredits,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    sourceId: data.stripeSubscriptionId,
  })
}

// ========================================
// GRANT OPERATIONS (ADMIN ONLY)
// ========================================

/**
 * Accorde des crédits à une organisation (admin uniquement)
 */
export const grantCreditsService = async (
  organizationId: string,
  amount: number,
  options: GrantCreditsOptions = {}
): Promise<CreditEntry> => {
  const parsed = grantCreditsServiceSchema.safeParse({
    organizationId,
    amount,
    options,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canGrant = await canGrantCredits()
  if (!canGrant) {
    throw new AuthorizationError('Seul un admin peut accorder des crédits')
  }

  logger.info('Admin granting credits', {
    organizationId,
    amount,
    reason: options.reason,
    expiresAt: options.expiresAt,
  })

  return grantCreditsTxnDao({
    organizationId,
    amount,
    reason: options.reason,
    expiresAt: options.expiresAt,
  })
}

// ========================================
// PACK PURCHASE OPERATIONS
// ========================================

// Codes des packs de crédits dans la DB
const CREDIT_PACK_CODES = ['10tokens', '50tokens', '150tokens'] as const

/**
 * Récupère les packs de crédits disponibles depuis la DB
 */
export const getCreditPacksService = async (): Promise<CreditPackConfig[]> => {
  const packs = await Promise.all(
    CREDIT_PACK_CODES.map((code) => getPlanByCodeDao(code))
  )

  return packs
    .filter((plan) => plan !== undefined)
    .map((plan) => {
      const limits = plan.limits as {credits?: number} | null
      const credits = limits?.credits ?? 0
      const priceInCents = Math.round(Number(plan.price) * 100)

      return {
        id: plan.code,
        name: plan.planName,
        credits,
        price: priceInCents,
        pricePerCredit: credits > 0 ? Math.round(priceInCents / credits) : 0,
        stripePriceId: plan.priceId,
        popular: plan.code === '50tokens',
      }
    })
}

/**
 * Initie l'achat d'un pack de crédits
 * Retourne l'URL de checkout Stripe
 */
export const purchaseCreditPackService = async (
  organizationId: string,
  packId: string
): Promise<{checkoutUrl: string}> => {
  const parsed = purchasePackServiceSchema.safeParse({organizationId, packId})
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const canPurchase = await canPurchasePack(organizationId)
  if (!canPurchase) {
    throw new AuthorizationError('Accès non autorisé pour acheter des packs')
  }

  // Récupérer le pack depuis la DB
  const plan = await getPlanByCodeDao(packId)
  if (!plan) {
    throw new ValidationError('Pack non trouvé')
  }

  if (!plan.priceId) {
    throw new ValidationError("Ce pack n'est pas encore configuré dans Stripe")
  }

  // TODO: Intégrer avec Better Auth pour créer la session Stripe
  throw new Error(
    'Credit pack purchase not yet implemented - use Better Auth checkout'
  )
}

/**
 * Complète l'achat d'un pack après le paiement Stripe
 * Appelé par le webhook checkout.session.completed
 */
export const completeCreditPackPurchaseService = async (params: {
  organizationId: string
  packId: string
  credits: number
  stripeSessionId: string
  expiresInDays?: number | null
}): Promise<CreditEntry> => {
  logger.info('Completing credit pack purchase', params)

  let expiresAt: Date | undefined
  if (params.expiresInDays) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + params.expiresInDays)
  }

  return addPackCreditsTxnDao({
    organizationId: params.organizationId,
    amount: params.credits,
    sourceId: params.stripeSessionId,
    expiresAt,
  })
}

// ========================================
// ADMIN STATS OPERATIONS
// ========================================

/**
 * Vérifie si l'utilisateur peut voir les stats admin
 */
export const canViewAdminCreditsStatsService = async (): Promise<boolean> => {
  return canReadAllCreditsStats()
}

// ========================================
// SUBSCRIPTION CREDIT ALLOCATION (Better Auth callbacks)
// ========================================

/**
 * Alloue les crédits lors de la création ou renouvellement d'une subscription
 * Appelé depuis les callbacks Better Auth (onSubscriptionComplete, onSubscriptionUpdate)
 */
export const allocateCreditsOnSubscriptionService = async (subscription: {
  id: string
  plan: string
  referenceId: string
  stripeSubscriptionId?: string | null
  stripeCustomerId?: string | null
}): Promise<void> => {
  logger.info('💳 Allocation crédits depuis Better Auth callback...', {
    subscriptionId: subscription.id,
    plan: subscription.plan,
    referenceId: subscription.referenceId,
  })

  try {
    // Récupérer le plan pour obtenir les crédits mensuels
    const plan = await getPlanByCodeDao(subscription.plan)
    if (!plan) {
      logger.warn(`⚠️ Plan ${subscription.plan} non trouvé - skip`)
      return
    }

    const planLimits = plan.limits as Record<string, number> | undefined
    const monthlyCredits = planLimits?.credits ?? 0

    if (monthlyCredits === 0) {
      logger.info(
        `📋 Plan ${subscription.plan} n'a pas de crédits mensuels - skip`
      )
      return
    }

    // Récupérer les dates de période depuis Stripe
    let periodStart: Date
    let periodEnd: Date

    if (subscription.stripeSubscriptionId) {
      const stripeSubscription = await stripeClient.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      )

      // Stripe API 2025-11-17 : les dates peuvent être dans items.data ou à la racine
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSub = stripeSubscription as any
      const periodStartTimestamp =
        rawSub.current_period_start ||
        rawSub.items?.data?.[0]?.current_period_start
      const periodEndTimestamp =
        rawSub.current_period_end || rawSub.items?.data?.[0]?.current_period_end

      logger.debug('📅 Stripe subscription period data:', {
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
        rawKeys: Object.keys(rawSub),
      })

      if (periodStartTimestamp && periodEndTimestamp) {
        periodStart = new Date(periodStartTimestamp * 1000)
        periodEnd = new Date(periodEndTimestamp * 1000)
      } else {
        // Fallback si les dates ne sont pas trouvées
        logger.warn(
          '⚠️ Dates de période non trouvées dans Stripe, utilisation du fallback'
        )
        periodStart = new Date()
        periodEnd = new Date()
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      }
    } else {
      // Fallback si pas de subscription Stripe (cas rare)
      periodStart = new Date()
      periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // Récupérer les overrides de l'organisation
    const organization = await getOrganizationByIdDao(subscription.referenceId)
    const limitOverrides = organization?.limitOverrides as
      | Record<string, number>
      | undefined
    const overrideCredits = limitOverrides?.credits ?? 0

    // Allouer les crédits
    // Note: sourceId doit être un UUID - utiliser l'ID Better Auth, pas l'ID Stripe
    await allocateMonthlyCreditsTxnDao({
      organizationId: subscription.referenceId,
      monthlyCredits,
      overrideCredits: overrideCredits > 0 ? overrideCredits : undefined,
      periodStart,
      periodEnd,
      sourceId: subscription.id, // UUID de la subscription Better Auth
    })

    logger.info('✅ Crédits alloués avec succès depuis Better Auth:', {
      organizationId: subscription.referenceId,
      monthlyCredits,
      overrideCredits,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  } catch (error) {
    logger.error('❌ Erreur allocation crédits depuis Better Auth:', error)
    // Ne pas throw pour ne pas bloquer le callback Better Auth
  }
}
