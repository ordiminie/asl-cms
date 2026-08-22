import {and, count, eq, isNull, lte, sql, sum} from 'drizzle-orm'

import {
  affiliate,
  affiliateCommission,
  AffiliateCommissionModel,
  AffiliateModel,
  affiliatePayout,
  AffiliatePayoutModel,
  affiliateProgramReward,
  AffiliateProgramRewardModel,
  referral,
  ReferralModel,
} from '@/db/models/affiliate-model'
import db from '@/db/models/db'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  CommissionStatusConst,
  CommissionTypeConst,
  CreateCommission,
  CreateReferral,
  PayoutStatusConst,
  ReferralStatusConst,
} from '@/services/types/domain/affiliate-types'

// ========================================
// AFFILIATE
// ========================================

export const getAffiliateByUserIdDao = async (
  userId: string
): Promise<AffiliateModel | undefined> => {
  return db.query.affiliate.findFirst({
    where: (row, {eq: equals}) => equals(row.userId, userId),
  })
}

export const getAffiliateByCodeDao = async (
  code: string
): Promise<AffiliateModel | undefined> => {
  return db.query.affiliate.findFirst({
    where: (row, {eq: equals}) => equals(row.code, code),
  })
}

export const getAffiliateByIdDao = async (
  id: string
): Promise<AffiliateModel | undefined> => {
  return db.query.affiliate.findFirst({
    where: (row, {eq: equals}) => equals(row.id, id),
  })
}

export const isAffiliateCodeTakenDao = async (
  code: string,
  exceptUserId?: string
): Promise<boolean> => {
  const existing = await getAffiliateByCodeDao(code)
  if (!existing) return false
  return exceptUserId ? existing.userId !== exceptUserId : true
}

/**
 * Crée l'affilié s'il n'existe pas, met à jour son code sinon.
 *
 * Le ref appartient à l'utilisateur et reste unique dans toute l'application :
 * l'unicité est portée par l'index, pas par une vérification applicative qui
 * laisserait passer deux inscriptions simultanées.
 */
export const upsertAffiliateCodeTxnDao = async (
  userId: string,
  code: string
): Promise<AffiliateModel> => {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(affiliate)
      .values({userId, code})
      .onConflictDoUpdate({
        target: affiliate.userId,
        set: {code, updatedAt: new Date()},
      })
      .returning()
    return row
  })
}

// ========================================
// PROGRAM REWARDS
// ========================================

export const getProgramRewardByPlanCodeDao = async (
  planCode: string
): Promise<AffiliateProgramRewardModel | undefined> => {
  return db.query.affiliateProgramReward.findFirst({
    where: (row, {and: every, eq: equals}) =>
      every(equals(row.planCode, planCode), equals(row.isActive, true)),
  })
}

export const getActiveProgramRewardsDao = async (): Promise<
  AffiliateProgramRewardModel[]
> => {
  return db
    .select()
    .from(affiliateProgramReward)
    .where(eq(affiliateProgramReward.isActive, true))
}

// ========================================
// REFERRAL
// ========================================

export const getReferralByOrganizationIdDao = async (
  organizationId: string
): Promise<ReferralModel | undefined> => {
  return db.query.referral.findFirst({
    where: (row, {eq: equals}) => equals(row.organizationId, organizationId),
  })
}

/**
 * Pose l'attribution. Idempotent : une organisation déjà attribuée conserve son
 * affilié d'origine, l'appel suivant renvoie la ligne existante sans rien
 * modifier. C'est ce qui rend l'attribution définitive.
 */
export const createReferralTxnDao = async (
  data: CreateReferral
): Promise<ReferralModel> => {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(referral)
      .values({
        affiliateId: data.affiliateId,
        organizationId: data.organizationId,
        referredUserId: data.referredUserId,
        source: data.source ?? 'cookie',
      })
      .onConflictDoNothing()
      .returning()

    if (inserted) return inserted

    const existing = await tx.query.referral.findFirst({
      where: (row, {eq: equals}) =>
        equals(row.organizationId, data.organizationId),
    })
    if (!existing) {
      throw new Error(
        `Referral introuvable après conflit pour l'organisation ${data.organizationId}`
      )
    }
    return existing
  })
}

export const getReferralsByAffiliateIdDao = async (
  affiliateId: string
): Promise<ReferralModel[]> => {
  return db
    .select()
    .from(referral)
    .where(
      and(
        eq(referral.affiliateId, affiliateId),
        eq(referral.status, ReferralStatusConst.ACTIVE)
      )
    )
}

// ========================================
// COMMISSION
// ========================================

/**
 * Crée la prime. Idempotent sur deux dimensions, toutes deux garanties par des
 * index uniques partiels : une facture Stripe ne peut produire qu'une prime, et
 * une organisation ne peut en produire qu'une sur toute sa vie.
 *
 * Un conflit n'est pas une erreur : c'est le cas normal d'un webhook rejoué.
 */
export const createBountyCommissionTxnDao = async (
  data: CreateCommission
): Promise<{commission: AffiliateCommissionModel; created: boolean}> => {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(affiliateCommission)
      .values({
        affiliateId: data.affiliateId,
        referralId: data.referralId,
        organizationId: data.organizationId,
        type: CommissionTypeConst.BOUNTY,
        status: CommissionStatusConst.PENDING,
        planCode: data.planCode,
        amountCents: data.amountCents,
        currency: data.currency ?? 'USD',
        sourceId: data.sourceId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        maturesAt: data.maturesAt,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted) return {commission: inserted, created: true}

    const existing = await tx.query.affiliateCommission.findFirst({
      where: (row, {and: every, eq: equals}) =>
        every(
          equals(row.organizationId, data.organizationId),
          equals(row.type, CommissionTypeConst.BOUNTY)
        ),
    })
    if (!existing) {
      throw new Error(
        `Commission introuvable après conflit pour l'organisation ${data.organizationId}`
      )
    }
    return {commission: existing, created: false}
  })
}

/**
 * Fait mûrir les primes dont le délai de carence est écoulé.
 * Seules les lignes 'pending' basculent : une ligne déjà payée ne peut pas
 * revenir en arrière.
 */
export const approveMaturedCommissionsDao = async (
  now: Date
): Promise<number> => {
  const rows = await db
    .update(affiliateCommission)
    .set({status: CommissionStatusConst.APPROVED, approvedAt: now})
    .where(
      and(
        eq(affiliateCommission.status, CommissionStatusConst.PENDING),
        lte(affiliateCommission.maturesAt, now)
      )
    )
    .returning({id: affiliateCommission.id})
  return rows.length
}

export const getCommissionsByAffiliateIdDao = async (
  affiliateId: string,
  pagination: Pagination
): Promise<PaginatedResponse<AffiliateCommissionModel>> => {
  const [rows, [{total}]] = await Promise.all([
    db
      .select()
      .from(affiliateCommission)
      .where(eq(affiliateCommission.affiliateId, affiliateId))
      .orderBy(sql`${affiliateCommission.createdAt} desc`)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({total: count()})
      .from(affiliateCommission)
      .where(eq(affiliateCommission.affiliateId, affiliateId)),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(total / pagination.limit)

  return {
    data: rows,
    pagination: {total, page, limit: pagination.limit, totalPages},
  }
}

export const getCommissionsByPaymentIntentIdDao = async (
  paymentIntentId: string
): Promise<AffiliateCommissionModel[]> => {
  return db
    .select()
    .from(affiliateCommission)
    .where(eq(affiliateCommission.stripePaymentIntentId, paymentIntentId))
}

export const getCommissionsBySourceIdDao = async (
  sourceId: string
): Promise<AffiliateCommissionModel[]> => {
  return db
    .select()
    .from(affiliateCommission)
    .where(eq(affiliateCommission.sourceId, sourceId))
}

/**
 * Traite un remboursement.
 *
 * Avant paiement, la prime est simplement annulée. Après paiement, elle est
 * immuable : on écrit une ligne de compensation au montant négatif, qui se
 * déduira du versement suivant.
 */
export const refundCommissionTxnDao = async (
  commissionId: string,
  reason: string,
  now: Date
): Promise<AffiliateCommissionModel | undefined> => {
  return db.transaction(async (tx) => {
    const existing = await tx.query.affiliateCommission.findFirst({
      where: (row, {eq: equals}) => equals(row.id, commissionId),
    })
    if (!existing) return undefined

    if (existing.status === CommissionStatusConst.PAID) {
      const [clawback] = await tx
        .insert(affiliateCommission)
        .values({
          affiliateId: existing.affiliateId,
          referralId: existing.referralId,
          organizationId: existing.organizationId,
          type: CommissionTypeConst.CLAWBACK,
          status: CommissionStatusConst.APPROVED,
          planCode: existing.planCode,
          amountCents: -Math.abs(existing.amountCents),
          currency: existing.currency,
          sourceId: existing.sourceId,
          stripeSubscriptionId: existing.stripeSubscriptionId,
          stripePaymentIntentId: existing.stripePaymentIntentId,
          maturesAt: now,
          approvedAt: now,
          voidReason: reason,
          parentCommissionId: existing.id,
        })
        .returning()
      return clawback
    }

    if (
      existing.status === CommissionStatusConst.REFUNDED ||
      existing.status === CommissionStatusConst.VOIDED
    ) {
      return existing
    }

    const [updated] = await tx
      .update(affiliateCommission)
      .set({
        status: CommissionStatusConst.REFUNDED,
        voidedAt: now,
        voidReason: reason,
      })
      .where(eq(affiliateCommission.id, commissionId))
      .returning()
    return updated
  })
}

// ========================================
// AGGREGATES
// ========================================

type AffiliateTotals = {
  referredOrganizations: number
  waitingCount: number
  waitingCents: number
  dueCents: number
  paidCents: number
}

const toCents = (value: string | null): number => Number(value ?? 0)

export const getAffiliateTotalsDao = async (
  affiliateId: string
): Promise<AffiliateTotals> => {
  const [[referrals], [pending], [due], [paid]] = await Promise.all([
    db
      .select({total: count()})
      .from(referral)
      .where(
        and(
          eq(referral.affiliateId, affiliateId),
          eq(referral.status, ReferralStatusConst.ACTIVE)
        )
      ),
    db
      .select({total: count(), amount: sum(affiliateCommission.amountCents)})
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.affiliateId, affiliateId),
          eq(affiliateCommission.status, CommissionStatusConst.PENDING)
        )
      ),
    db
      .select({amount: sum(affiliateCommission.amountCents)})
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.affiliateId, affiliateId),
          eq(affiliateCommission.status, CommissionStatusConst.APPROVED),
          isNull(affiliateCommission.payoutId)
        )
      ),
    db
      .select({amount: sum(affiliateCommission.amountCents)})
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.affiliateId, affiliateId),
          eq(affiliateCommission.status, CommissionStatusConst.PAID)
        )
      ),
  ])

  return {
    referredOrganizations: referrals.total,
    waitingCount: pending.total,
    waitingCents: toCents(pending.amount),
    dueCents: toCents(due.amount),
    paidCents: toCents(paid.amount),
  }
}

// ========================================
// PAYOUT
// ========================================

/**
 * Enregistre un versement déjà effectué hors application.
 *
 * L'écriture est atomique et protégée par un verrou consultatif : deux clics
 * simultanés sur « marquer payé » ne peuvent pas produire deux versements pour
 * les mêmes commissions.
 */
export const createPayoutTxnDao = async (params: {
  affiliateId: string
  externalReference?: string
  notes?: string
  initiatedByUserId?: string
  now: Date
}): Promise<AffiliatePayoutModel | undefined> => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('affiliate_payout:' || ${params.affiliateId}))`
    )

    const eligible = await tx
      .select()
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.affiliateId, params.affiliateId),
          eq(affiliateCommission.status, CommissionStatusConst.APPROVED),
          isNull(affiliateCommission.payoutId)
        )
      )

    if (eligible.length === 0) return undefined

    const amountCents = eligible.reduce(
      (total, row) => total + row.amountCents,
      0
    )
    if (amountCents <= 0) return undefined

    const affiliateRow = await tx.query.affiliate.findFirst({
      where: (row, {eq: equals}) => equals(row.id, params.affiliateId),
    })

    const [payout] = await tx
      .insert(affiliatePayout)
      .values({
        affiliateId: params.affiliateId,
        amountCents,
        currency: eligible[0].currency,
        status: PayoutStatusConst.PAID,
        method: affiliateRow?.payoutMethod ?? 'manual',
        externalReference: params.externalReference,
        notes: params.notes,
        initiatedByUserId: params.initiatedByUserId,
        paidAt: params.now,
        affiliateSnapshot: affiliateRow
          ? {
              code: affiliateRow.code,
              type: affiliateRow.type,
              legalName: affiliateRow.legalName,
              taxId: affiliateRow.taxId,
              country: affiliateRow.country,
            }
          : undefined,
      })
      .returning()

    for (const row of eligible) {
      await tx
        .update(affiliateCommission)
        .set({
          status: CommissionStatusConst.PAID,
          paidAt: params.now,
          payoutId: payout.id,
        })
        .where(eq(affiliateCommission.id, row.id))
    }

    return payout
  })
}

export const getPayoutsByAffiliateIdDao = async (
  affiliateId: string
): Promise<AffiliatePayoutModel[]> => {
  return db
    .select()
    .from(affiliatePayout)
    .where(eq(affiliatePayout.affiliateId, affiliateId))
    .orderBy(sql`${affiliatePayout.createdAt} desc`)
}

// ========================================
// ADMIN
// ========================================

export const getAffiliatesWithPaginationDao = async (
  pagination: Pagination
): Promise<PaginatedResponse<AffiliateModel>> => {
  const [rows, [{total}]] = await Promise.all([
    db
      .select()
      .from(affiliate)
      .orderBy(sql`${affiliate.createdAt} desc`)
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({total: count()}).from(affiliate),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(total / pagination.limit)

  return {
    data: rows,
    pagination: {total, page, limit: pagination.limit, totalPages},
  }
}
