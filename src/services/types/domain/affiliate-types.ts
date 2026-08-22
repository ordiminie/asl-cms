import {
  AffiliateAddModel,
  AffiliateCommissionAddModel,
  AffiliateCommissionModel,
  AffiliateModel,
  AffiliatePayoutModel,
  AffiliateProgramRewardModel,
  ReferralModel,
} from '@/db/models/affiliate-model'

export type Affiliate = AffiliateModel
export type Referral = ReferralModel
export type AffiliateCommission = AffiliateCommissionModel
export type AffiliatePayout = AffiliatePayoutModel
export type AffiliateProgramReward = AffiliateProgramRewardModel

export type AffiliateStatus = 'pending' | 'active' | 'suspended' | 'banned'

export const AffiliateStatusConst = {
  PENDING: 'pending' as AffiliateStatus,
  ACTIVE: 'active' as AffiliateStatus,
  SUSPENDED: 'suspended' as AffiliateStatus,
  BANNED: 'banned' as AffiliateStatus,
} as const

export type AffiliateType = 'customer' | 'professional'

export const AffiliateTypeConst = {
  CUSTOMER: 'customer' as AffiliateType,
  PROFESSIONAL: 'professional' as AffiliateType,
} as const

export type AffiliatePayoutMethod = 'credit' | 'manual'

export const AffiliatePayoutMethodConst = {
  CREDIT: 'credit' as AffiliatePayoutMethod,
  MANUAL: 'manual' as AffiliatePayoutMethod,
} as const

export type ReferralSource = 'cookie' | 'signup_code' | 'manual'

export const ReferralSourceConst = {
  COOKIE: 'cookie' as ReferralSource,
  SIGNUP_CODE: 'signup_code' as ReferralSource,
  MANUAL: 'manual' as ReferralSource,
} as const

export type ReferralStatus = 'active' | 'self_referral' | 'voided'

export const ReferralStatusConst = {
  ACTIVE: 'active' as ReferralStatus,
  SELF_REFERRAL: 'self_referral' as ReferralStatus,
  VOIDED: 'voided' as ReferralStatus,
} as const

export type CommissionType = 'bounty' | 'clawback' | 'adjustment'

export const CommissionTypeConst = {
  BOUNTY: 'bounty' as CommissionType,
  CLAWBACK: 'clawback' as CommissionType,
  ADJUSTMENT: 'adjustment' as CommissionType,
} as const

export type CommissionStatus =
  'pending' | 'approved' | 'paid' | 'refunded' | 'voided'

export const CommissionStatusConst = {
  PENDING: 'pending' as CommissionStatus,
  APPROVED: 'approved' as CommissionStatus,
  PAID: 'paid' as CommissionStatus,
  REFUNDED: 'refunded' as CommissionStatus,
  VOIDED: 'voided' as CommissionStatus,
} as const

export type PayoutStatus = 'pending' | 'paid' | 'failed'

export const PayoutStatusConst = {
  PENDING: 'pending' as PayoutStatus,
  PAID: 'paid' as PayoutStatus,
  FAILED: 'failed' as PayoutStatus,
} as const

export type CreateAffiliate = Pick<AffiliateAddModel, 'userId' | 'code'> & {
  type?: AffiliateType
  payoutMethod?: AffiliatePayoutMethod
}

export type CreateReferral = {
  affiliateId: string
  organizationId: string
  referredUserId: string
  source?: ReferralSource
}

export type CreateCommission = Pick<
  AffiliateCommissionAddModel,
  'affiliateId' | 'referralId' | 'organizationId' | 'planCode' | 'amountCents'
> & {
  currency?: string
  sourceId?: string
  stripeSubscriptionId?: string
  stripePaymentIntentId?: string
  maturesAt: Date
}

export type AffiliateDashboardDTO = {
  code: string | null
  status: AffiliateStatus
  currency: string
  referredOrganizations: number
  waitingCount: number
  waitingCents: number
  dueCents: number
  paidCents: number
}

export type AffiliateCommissionDTO = {
  id: string
  planCode: string
  amountCents: number
  currency: string
  status: CommissionStatus
  type: CommissionType
  maturesAt: Date
  createdAt: Date
}

export type AdminAffiliateRowDTO = {
  affiliateId: string
  userId: string
  code: string
  status: AffiliateStatus
  referredOrganizations: number
  dueCents: number
  paidCents: number
  currency: string
}
