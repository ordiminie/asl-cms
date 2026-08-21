import {addDays} from 'date-fns'

import {
  approveMaturedCommissionsDao,
  createBountyCommissionTxnDao,
  createPayoutTxnDao,
  createReferralTxnDao,
  getAffiliateByCodeDao,
  getAffiliateByIdDao,
  getAffiliateByUserIdDao,
  getAffiliatesWithPaginationDao,
  getAffiliateTotalsDao,
  getCommissionsByAffiliateIdDao,
  getCommissionsBySourceIdDao,
  getProgramRewardByPlanCodeDao,
  getReferralByOrganizationIdDao,
  isAffiliateCodeTakenDao,
  refundCommissionTxnDao,
  upsertAffiliateCodeTxnDao,
} from '@/db/repositories/affiliate-repository'
import {logger} from '@/lib/logger'

import {getAuthUser} from './authentication/auth-service'
import {
  canAdministerAffiliates,
  canManageOwnAffiliate,
} from './authorization/affiliate-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {PaginatedResponse, Pagination} from './types/common-type'
import {
  Affiliate,
  AffiliateCommission,
  AffiliateDashboardDTO,
  AffiliatePayout,
  AffiliateStatusConst,
  CommissionStatusConst,
  ReferralSourceConst,
} from './types/domain/affiliate-types'
import {
  markPayoutPaidServiceSchema,
  recordBountyServiceSchema,
  setAffiliateCodeServiceSchema,
} from './validation/affiliate-validation'

const DEFAULT_CURRENCY = 'USD'

// ========================================
// ESPACE AFFILIÉ
// ========================================

export const getMyAffiliateService = async (): Promise<
  Affiliate | undefined
> => {
  const authUser = await getAuthUser()
  const canManage = await canManageOwnAffiliate()
  if (!authUser || !canManage) {
    throw new AuthorizationError("Accès refusé au programme d'affiliation")
  }

  return getAffiliateByUserIdDao(authUser.id)
}

/**
 * Crée ou remplace le ref de l'utilisateur connecté.
 *
 * Le code est normalisé en minuscules avant toute vérification : deux refs qui
 * ne diffèrent que par la casse sont le même ref.
 */
export const setMyAffiliateCodeService = async (
  code: string
): Promise<Affiliate> => {
  const parsed = setAffiliateCodeServiceSchema.safeParse({
    code: code?.toLowerCase(),
  })
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Code invalide'
    )
  }

  const authUser = await getAuthUser()
  const canManage = await canManageOwnAffiliate()
  if (!authUser || !canManage) {
    throw new AuthorizationError("Accès refusé au programme d'affiliation")
  }

  const normalizedCode = parsed.data.code

  const taken = await isAffiliateCodeTakenDao(normalizedCode, authUser.id)
  if (taken) {
    throw new ValidationError('Ce code est déjà utilisé')
  }

  logger.info('[AFFILIATE-SERVICE] set code', {userId: authUser.id})
  return upsertAffiliateCodeTxnDao(authUser.id, normalizedCode)
}

export const getMyAffiliateDashboardService =
  async (): Promise<AffiliateDashboardDTO> => {
    const affiliate = await getMyAffiliateService()

    if (!affiliate) {
      return {
        code: null,
        status: AffiliateStatusConst.ACTIVE,
        currency: DEFAULT_CURRENCY,
        referredOrganizations: 0,
        waitingCount: 0,
        waitingCents: 0,
        dueCents: 0,
        paidCents: 0,
      }
    }

    const totals = await getAffiliateTotalsDao(affiliate.id)

    return {
      code: affiliate.code,
      status: affiliate.status,
      currency: DEFAULT_CURRENCY,
      ...totals,
    }
  }

export const getMyAffiliateCommissionsService = async (
  pagination: Pagination
): Promise<PaginatedResponse<AffiliateCommission>> => {
  const affiliate = await getMyAffiliateService()

  if (!affiliate) {
    return {
      data: [],
      pagination: {total: 0, page: 1, limit: pagination.limit, totalPages: 0},
    }
  }

  return getCommissionsByAffiliateIdDao(affiliate.id, pagination)
}

// ========================================
// ATTRIBUTION (appelé à l'inscription, hors session établie)
// ========================================

/**
 * Attribue une organisation à l'affilié porteur du code.
 *
 * Pas de vérification d'autorisation : cette fonction est appelée depuis le
 * hook de création d'utilisateur, avant qu'une session existe. Elle est en
 * revanche strictement défensive — un code inconnu, un affilié suspendu ou un
 * auto-parrainage ne produisent rien plutôt qu'une erreur, pour ne jamais
 * casser une inscription.
 */
export const attributeReferralForOrganizationService = async (params: {
  code: string
  organizationId: string
  referredUserId: string
  source?: 'cookie' | 'signup_code' | 'manual'
}): Promise<{attributed: boolean; reason?: string}> => {
  const normalizedCode = params.code?.trim().toLowerCase()
  if (!normalizedCode) return {attributed: false, reason: 'empty_code'}

  const affiliate = await getAffiliateByCodeDao(normalizedCode)
  if (!affiliate) return {attributed: false, reason: 'unknown_code'}

  if (affiliate.status !== AffiliateStatusConst.ACTIVE) {
    return {attributed: false, reason: 'affiliate_inactive'}
  }

  if (affiliate.userId === params.referredUserId) {
    logger.info('[AFFILIATE-SERVICE] self-referral ignoré', {
      affiliateId: affiliate.id,
    })
    return {attributed: false, reason: 'self_referral'}
  }

  const existing = await getReferralByOrganizationIdDao(params.organizationId)
  if (existing) return {attributed: false, reason: 'already_attributed'}

  await createReferralTxnDao({
    affiliateId: affiliate.id,
    organizationId: params.organizationId,
    referredUserId: params.referredUserId,
    source: params.source ?? ReferralSourceConst.COOKIE,
  })

  logger.info('[AFFILIATE-SERVICE] attribution posée', {
    affiliateId: affiliate.id,
    organizationId: params.organizationId,
  })
  return {attributed: true}
}

// ========================================
// WEBHOOK (source de confiance, pas d'autorisation)
// ========================================

/**
 * Enregistre la prime d'une organisation référée.
 *
 * Appelé depuis le webhook Stripe, donc sans autorisation : la source est
 * considérée de confiance, exactement comme pour l'allocation de crédits.
 *
 * Trois garde-fous portent la fiabilité :
 * - le montant payé doit être strictement positif, ce qui écarte les essais ;
 * - le barème est lu en base, jamais codé en dur ;
 * - l'insertion est idempotente, un rejeu de webhook ne double pas la prime.
 */
export const recordBountyForPaidInvoiceService = async (params: {
  organizationId: string
  planCode: string
  sourceId: string
  amountPaidCents: number
  stripeSubscriptionId?: string
}): Promise<{created: boolean; reason?: string}> => {
  const parsed = recordBountyServiceSchema.safeParse(params)
  if (!parsed.success) {
    return {created: false, reason: parsed.error.issues[0]?.message}
  }

  const referral = await getReferralByOrganizationIdDao(params.organizationId)
  if (!referral) return {created: false, reason: 'not_referred'}
  if (referral.status !== 'active') {
    return {created: false, reason: 'referral_inactive'}
  }

  const reward = await getProgramRewardByPlanCodeDao(params.planCode)
  if (!reward || reward.bountyCents <= 0) {
    return {created: false, reason: 'no_reward_for_plan'}
  }

  const now = new Date()
  const {created} = await createBountyCommissionTxnDao({
    affiliateId: referral.affiliateId,
    referralId: referral.id,
    organizationId: params.organizationId,
    planCode: params.planCode,
    amountCents: reward.bountyCents,
    currency: reward.currency,
    sourceId: params.sourceId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    maturesAt: addDays(now, reward.holdDays),
  })

  if (created) {
    logger.info('[AFFILIATE-SERVICE] prime enregistrée', {
      organizationId: params.organizationId,
      planCode: params.planCode,
      amountCents: reward.bountyCents,
    })
  }

  return {created}
}

/**
 * Annule ou compense la prime rattachée à une facture remboursée.
 * Appelé depuis le webhook, sans autorisation.
 */
export const refundBountyBySourceService = async (
  sourceId: string,
  reason: string
): Promise<number> => {
  const commissions = await getCommissionsBySourceIdDao(sourceId)
  const now = new Date()
  let handled = 0

  for (const commission of commissions) {
    if (commission.type !== 'bounty') continue
    if (
      commission.status === CommissionStatusConst.REFUNDED ||
      commission.status === CommissionStatusConst.VOIDED
    ) {
      continue
    }
    await refundCommissionTxnDao(commission.id, reason, now)
    handled += 1
  }

  if (handled > 0) {
    logger.info('[AFFILIATE-SERVICE] remboursement traité', {sourceId, handled})
  }

  return handled
}

/**
 * Fait mûrir les primes dont la carence est écoulée. Appelé par le cron.
 */
export const approveMaturedCommissionsService = async (): Promise<{
  approved: number
}> => {
  const approved = await approveMaturedCommissionsDao(new Date())
  if (approved > 0) {
    logger.info('[AFFILIATE-SERVICE] primes mûries', {approved})
  }
  return {approved}
}

// ========================================
// ADMINISTRATION
// ========================================

export const getAffiliatesWithPaginationService = async (
  pagination: Pagination
): Promise<PaginatedResponse<Affiliate>> => {
  const canAdminister = await canAdministerAffiliates()
  if (!canAdminister) {
    throw new AuthorizationError("Accès refusé à l'administration des affiliés")
  }

  return getAffiliatesWithPaginationDao(pagination)
}

export const getAffiliateTotalsService = async (affiliateId: string) => {
  const canAdminister = await canAdministerAffiliates()
  if (!canAdminister) {
    throw new AuthorizationError("Accès refusé à l'administration des affiliés")
  }

  return getAffiliateTotalsDao(affiliateId)
}

/**
 * Enregistre un versement effectué hors application.
 *
 * L'action est idempotente : elle ne prend que les commissions mûres et non
 * encore rattachées à un versement. Relancée sur un affilié déjà soldé, elle ne
 * crée rien.
 */
export const markAffiliatePayoutPaidService = async (params: {
  affiliateId: string
  externalReference?: string
  notes?: string
}): Promise<AffiliatePayout | undefined> => {
  const parsed = markPayoutPaidServiceSchema.safeParse(params)
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Données invalides'
    )
  }

  const canAdminister = await canAdministerAffiliates()
  if (!canAdminister) {
    throw new AuthorizationError("Accès refusé à l'administration des affiliés")
  }

  const affiliate = await getAffiliateByIdDao(params.affiliateId)
  if (!affiliate) {
    throw new ValidationError('Affilié introuvable')
  }

  const authUser = await getAuthUser()

  const payout = await createPayoutTxnDao({
    affiliateId: params.affiliateId,
    externalReference: parsed.data.externalReference,
    notes: parsed.data.notes,
    initiatedByUserId: authUser?.id,
    now: new Date(),
  })

  if (payout) {
    logger.info('[AFFILIATE-SERVICE] versement enregistré', {
      affiliateId: params.affiliateId,
      amountCents: payout.amountCents,
    })
  }

  return payout
}
