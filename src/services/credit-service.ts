import {
  addPackCreditsTxnDao,
  allocateMonthlyCreditsTxnDao,
  consumeCreditsTxnDao,
  getBalanceDao,
  getDailyUsageDao,
  getRecentActivityDao,
  getUsedThisPeriodDao,
  grantCreditsTxnDao,
} from '@/db/repositories/credit-ledger-repository'
import {getActiveSubscriptionsOrFreePlanDao} from '@/db/repositories/subscription-repository'
import {logger} from '@/lib/logger'

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
  CreditUsageDay,
  DEFAULT_CREDIT_PACKS,
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

  // Pour les utilisateurs FREE sans subscription, utiliser 30 jours glissants
  let periodStart = activeSub?.periodStart ?? null
  let periodEnd = activeSub?.periodEnd ?? null

  if (!periodStart || !periodEnd) {
    const now = new Date()
    periodEnd = now
    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

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

  return getDailyUsageDao(organizationId, periodStart, periodEnd)
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

  return grantCreditsTxnDao({
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

/**
 * Récupère les packs de crédits disponibles
 */
export const getCreditPacksService = async () => {
  // Les packs sont disponibles publiquement
  return DEFAULT_CREDIT_PACKS
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

  const pack = DEFAULT_CREDIT_PACKS.find((p) => p.id === packId)
  if (!pack) {
    throw new ValidationError('Pack non trouvé')
  }

  if (!pack.stripePriceId) {
    throw new ValidationError("Ce pack n'est pas encore configuré dans Stripe")
  }

  // TODO: Intégrer avec credit-pack-checkout.ts pour créer la session Stripe
  // Pour le moment, on retourne une erreur indiquant que ce n'est pas encore implémenté
  throw new Error(
    'Credit pack purchase not yet implemented - configure Stripe price IDs'
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
