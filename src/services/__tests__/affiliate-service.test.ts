import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/affiliate-repository', () => ({
  getAffiliateByUserIdDao: vi.fn(),
  getAffiliateByCodeDao: vi.fn(),
  getAffiliateByIdDao: vi.fn(),
  isAffiliateCodeTakenDao: vi.fn(),
  upsertAffiliateCodeTxnDao: vi.fn(),
  getProgramRewardByPlanCodeDao: vi.fn(),
  getActiveProgramRewardsDao: vi.fn(),
  getReferralByOrganizationIdDao: vi.fn(),
  createReferralTxnDao: vi.fn(),
  getReferralsByAffiliateIdDao: vi.fn(),
  createBountyCommissionTxnDao: vi.fn(),
  approveMaturedCommissionsDao: vi.fn(),
  getCommissionsByAffiliateIdDao: vi.fn(),
  getCommissionsBySourceIdDao: vi.fn(),
  refundCommissionTxnDao: vi.fn(),
  getAffiliateTotalsDao: vi.fn(),
  createPayoutTxnDao: vi.fn(),
  getPayoutsByAffiliateIdDao: vi.fn(),
  getAffiliatesWithPaginationDao: vi.fn(),
}))

import * as affiliateRepository from '@/db/repositories/affiliate-repository'

import {
  approveMaturedCommissionsService,
  attributeReferralForOrganizationService,
  getMyAffiliateDashboardService,
  markAffiliatePayoutPaidService,
  recordBountyForPaidInvoiceService,
  refundBountyBySourceService,
  setMyAffiliateCodeService,
} from '../affiliate-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {
  Affiliate,
  AffiliateCommission,
  AffiliateProgramReward,
  Referral,
} from '../types/domain/affiliate-types'
import {setupAuthUserMocked} from './helper-service-test'
import {currentAuthUserId, userTest, userTestAdmin} from './service-test-data'

const affiliateId = faker.string.uuid()
const organizationId = faker.string.uuid()
const referralId = faker.string.uuid()
const otherUserId = faker.string.uuid()

const affiliateData: Affiliate = {
  id: affiliateId,
  userId: currentAuthUserId,
  code: 'mike',
  status: 'active',
  type: 'customer',
  payoutMethod: 'manual',
  legalName: null,
  taxId: null,
  country: null,
  suspendedAt: null,
  suspendedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const referralData: Referral = {
  id: referralId,
  affiliateId,
  organizationId,
  referredUserId: otherUserId,
  source: 'cookie',
  status: 'active',
  lockedAt: new Date(),
  createdAt: new Date(),
}

const rewardData: AffiliateProgramReward = {
  id: faker.string.uuid(),
  planCode: 'pro',
  bountyCents: 5000,
  currency: 'USD',
  holdDays: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const commissionData: AffiliateCommission = {
  id: faker.string.uuid(),
  affiliateId,
  referralId,
  organizationId,
  type: 'bounty',
  status: 'pending',
  planCode: 'pro',
  amountCents: 5000,
  currency: 'USD',
  sourceId: 'in_123',
  stripeSubscriptionId: 'sub_123',
  maturesAt: new Date(),
  approvedAt: null,
  paidAt: null,
  voidedAt: null,
  voidReason: null,
  parentCommissionId: null,
  payoutId: null,
  createdAt: new Date(),
}

describe('[USER] Espace affilié : AffiliateService', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()
    vi.mocked(affiliateRepository.getAffiliateByUserIdDao).mockResolvedValue(
      affiliateData
    )
    vi.mocked(affiliateRepository.isAffiliateCodeTakenDao).mockResolvedValue(
      false
    )
    vi.mocked(affiliateRepository.upsertAffiliateCodeTxnDao).mockResolvedValue(
      affiliateData
    )
    vi.mocked(affiliateRepository.getAffiliateTotalsDao).mockResolvedValue({
      referredOrganizations: 3,
      waitingCount: 1,
      waitingCents: 5000,
      dueCents: 15000,
      paidCents: 10000,
    })
  })

  it('should set its own affiliate code', async () => {
    const result = await setMyAffiliateCodeService('Mike')

    expect(result).toEqual(affiliateData)
    expect(affiliateRepository.upsertAffiliateCodeTxnDao).toHaveBeenCalledWith(
      currentAuthUserId,
      'mike'
    )
  })

  it('should reject a code already taken by someone else', async () => {
    vi.mocked(affiliateRepository.isAffiliateCodeTakenDao).mockResolvedValue(
      true
    )

    await expect(setMyAffiliateCodeService('mike')).rejects.toThrow(
      ValidationError
    )
    expect(affiliateRepository.upsertAffiliateCodeTxnDao).not.toHaveBeenCalled()
  })

  it('should reject a code with invalid characters', async () => {
    await expect(setMyAffiliateCodeService('Mike Codeur!')).rejects.toThrow(
      ValidationError
    )
    expect(affiliateRepository.upsertAffiliateCodeTxnDao).not.toHaveBeenCalled()
  })

  it('should read its own dashboard', async () => {
    const result = await getMyAffiliateDashboardService()

    expect(result.code).toBe('mike')
    expect(result.dueCents).toBe(15_000)
    expect(result.referredOrganizations).toBe(3)
  })

  it('should NOT administer affiliates', async () => {
    await expect(markAffiliatePayoutPaidService({affiliateId})).rejects.toThrow(
      AuthorizationError
    )
    expect(affiliateRepository.createPayoutTxnDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] Espace affilié : AffiliateService', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
  })

  it('should NOT read the affiliate dashboard', async () => {
    await expect(getMyAffiliateDashboardService()).rejects.toThrow(
      AuthorizationError
    )
  })

  it('should NOT set an affiliate code', async () => {
    await expect(setMyAffiliateCodeService('mike')).rejects.toThrow(
      AuthorizationError
    )
    expect(affiliateRepository.upsertAffiliateCodeTxnDao).not.toHaveBeenCalled()
  })
})

describe('[ADMIN] Versement : AffiliateService', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()
    vi.mocked(affiliateRepository.getAffiliateByIdDao).mockResolvedValue(
      affiliateData
    )
  })

  it('should record a payout', async () => {
    vi.mocked(affiliateRepository.createPayoutTxnDao).mockResolvedValue({
      id: faker.string.uuid(),
      affiliateId,
      amountCents: 15_000,
      currency: 'USD',
      status: 'paid',
      method: 'manual',
      externalReference: 'VIR-2026-01',
      affiliateSnapshot: null,
      initiatedByUserId: currentAuthUserId,
      notes: null,
      paidAt: new Date(),
      createdAt: new Date(),
    })

    const result = await markAffiliatePayoutPaidService({
      affiliateId,
      externalReference: 'VIR-2026-01',
    })

    expect(result?.amountCents).toBe(15_000)
    expect(affiliateRepository.createPayoutTxnDao).toHaveBeenCalled()
  })

  it('should stay idempotent when nothing is due', async () => {
    vi.mocked(affiliateRepository.createPayoutTxnDao).mockResolvedValue(
      undefined
    )

    const result = await markAffiliatePayoutPaidService({affiliateId})

    expect(result).toBeUndefined()
  })

  it('should reject an unknown affiliate', async () => {
    vi.mocked(affiliateRepository.getAffiliateByIdDao).mockResolvedValue(
      undefined
    )

    await expect(markAffiliatePayoutPaidService({affiliateId})).rejects.toThrow(
      ValidationError
    )
    expect(affiliateRepository.createPayoutTxnDao).not.toHaveBeenCalled()
  })
})

describe('Attribution : AffiliateService', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
    vi.mocked(affiliateRepository.getAffiliateByCodeDao).mockResolvedValue(
      affiliateData
    )
    vi.mocked(
      affiliateRepository.getReferralByOrganizationIdDao
    ).mockResolvedValue(undefined)
    vi.mocked(affiliateRepository.createReferralTxnDao).mockResolvedValue(
      referralData
    )
  })

  it('should attribute an organization to the affiliate', async () => {
    const result = await attributeReferralForOrganizationService({
      code: 'MIKE',
      organizationId,
      referredUserId: otherUserId,
    })

    expect(result.attributed).toBe(true)
    expect(affiliateRepository.getAffiliateByCodeDao).toHaveBeenCalledWith(
      'mike'
    )
  })

  it('should ignore a self-referral', async () => {
    const result = await attributeReferralForOrganizationService({
      code: 'mike',
      organizationId,
      referredUserId: currentAuthUserId,
    })

    expect(result).toEqual({attributed: false, reason: 'self_referral'})
    expect(affiliateRepository.createReferralTxnDao).not.toHaveBeenCalled()
  })

  it('should ignore an unknown code', async () => {
    vi.mocked(affiliateRepository.getAffiliateByCodeDao).mockResolvedValue(
      undefined
    )

    const result = await attributeReferralForOrganizationService({
      code: 'ghost',
      organizationId,
      referredUserId: otherUserId,
    })

    expect(result).toEqual({attributed: false, reason: 'unknown_code'})
    expect(affiliateRepository.createReferralTxnDao).not.toHaveBeenCalled()
  })

  it('should ignore a suspended affiliate', async () => {
    vi.mocked(affiliateRepository.getAffiliateByCodeDao).mockResolvedValue({
      ...affiliateData,
      status: 'suspended',
    })

    const result = await attributeReferralForOrganizationService({
      code: 'mike',
      organizationId,
      referredUserId: otherUserId,
    })

    expect(result).toEqual({attributed: false, reason: 'affiliate_inactive'})
    expect(affiliateRepository.createReferralTxnDao).not.toHaveBeenCalled()
  })

  it('should never re-attribute an organization', async () => {
    vi.mocked(
      affiliateRepository.getReferralByOrganizationIdDao
    ).mockResolvedValue(referralData)

    const result = await attributeReferralForOrganizationService({
      code: 'mike',
      organizationId,
      referredUserId: otherUserId,
    })

    expect(result).toEqual({attributed: false, reason: 'already_attributed'})
    expect(affiliateRepository.createReferralTxnDao).not.toHaveBeenCalled()
  })
})

describe('Prime sur facture payée : AffiliateService', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
    vi.mocked(
      affiliateRepository.getReferralByOrganizationIdDao
    ).mockResolvedValue(referralData)
    vi.mocked(
      affiliateRepository.getProgramRewardByPlanCodeDao
    ).mockResolvedValue(rewardData)
    vi.mocked(
      affiliateRepository.createBountyCommissionTxnDao
    ).mockResolvedValue({commission: commissionData, created: true})
  })

  it('should record the bounty from the program table', async () => {
    const result = await recordBountyForPaidInvoiceService({
      organizationId,
      planCode: 'pro',
      sourceId: 'in_123',
      amountPaidCents: 2900,
      stripeSubscriptionId: 'sub_123',
    })

    expect(result.created).toBe(true)
    const call = vi.mocked(affiliateRepository.createBountyCommissionTxnDao)
      .mock.calls[0][0]
    expect(call.amountCents).toBe(5000)
    expect(call.sourceId).toBe('in_123')
    expect(call.maturesAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('should NEVER pay a bounty on a zero-amount invoice (trial)', async () => {
    const result = await recordBountyForPaidInvoiceService({
      organizationId,
      planCode: 'pro',
      sourceId: 'in_trial',
      amountPaidCents: 0,
    })

    expect(result.created).toBe(false)
    expect(
      affiliateRepository.createBountyCommissionTxnDao
    ).not.toHaveBeenCalled()
  })

  it('should skip an organization that was never referred', async () => {
    vi.mocked(
      affiliateRepository.getReferralByOrganizationIdDao
    ).mockResolvedValue(undefined)

    const result = await recordBountyForPaidInvoiceService({
      organizationId,
      planCode: 'pro',
      sourceId: 'in_123',
      amountPaidCents: 2900,
    })

    expect(result).toEqual({created: false, reason: 'not_referred'})
    expect(
      affiliateRepository.createBountyCommissionTxnDao
    ).not.toHaveBeenCalled()
  })

  it('should skip a plan with no reward configured', async () => {
    vi.mocked(
      affiliateRepository.getProgramRewardByPlanCodeDao
    ).mockResolvedValue(undefined)

    const result = await recordBountyForPaidInvoiceService({
      organizationId,
      planCode: 'free',
      sourceId: 'in_123',
      amountPaidCents: 2900,
    })

    expect(result).toEqual({created: false, reason: 'no_reward_for_plan'})
    expect(
      affiliateRepository.createBountyCommissionTxnDao
    ).not.toHaveBeenCalled()
  })

  it('should report a replayed webhook as not created', async () => {
    vi.mocked(
      affiliateRepository.createBountyCommissionTxnDao
    ).mockResolvedValue({commission: commissionData, created: false})

    const result = await recordBountyForPaidInvoiceService({
      organizationId,
      planCode: 'pro',
      sourceId: 'in_123',
      amountPaidCents: 2900,
    })

    expect(result.created).toBe(false)
  })
})

describe('Remboursement et maturation : AffiliateService', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
  })

  it('should refund every bounty tied to the invoice', async () => {
    vi.mocked(
      affiliateRepository.getCommissionsBySourceIdDao
    ).mockResolvedValue([commissionData])
    vi.mocked(affiliateRepository.refundCommissionTxnDao).mockResolvedValue(
      commissionData
    )

    const handled = await refundBountyBySourceService('in_123', 'refund')

    expect(handled).toBe(1)
    expect(affiliateRepository.refundCommissionTxnDao).toHaveBeenCalledWith(
      commissionData.id,
      'refund',
      expect.any(Date)
    )
  })

  it('should not refund a commission already refunded', async () => {
    vi.mocked(
      affiliateRepository.getCommissionsBySourceIdDao
    ).mockResolvedValue([{...commissionData, status: 'refunded'}])

    const handled = await refundBountyBySourceService('in_123', 'refund')

    expect(handled).toBe(0)
    expect(affiliateRepository.refundCommissionTxnDao).not.toHaveBeenCalled()
  })

  it('should not touch a clawback line', async () => {
    vi.mocked(
      affiliateRepository.getCommissionsBySourceIdDao
    ).mockResolvedValue([
      {...commissionData, type: 'clawback', amountCents: -5000},
    ])

    const handled = await refundBountyBySourceService('in_123', 'refund')

    expect(handled).toBe(0)
  })

  it('should approve matured commissions', async () => {
    vi.mocked(
      affiliateRepository.approveMaturedCommissionsDao
    ).mockResolvedValue(4)

    const result = await approveMaturedCommissionsService()

    expect(result).toEqual({approved: 4})
    expect(
      affiliateRepository.approveMaturedCommissionsDao
    ).toHaveBeenCalledWith(expect.any(Date))
  })
})
