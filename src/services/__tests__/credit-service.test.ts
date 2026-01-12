import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
  addPackCreditsTxnDao,
  checkAllocationExistsDao,
  consumeCreditsTxnDao,
  getBalanceDao,
  getDailyUsageDao,
  getRecentActivityDao,
  getUsedThisPeriodDao,
  grantCreditsTxnDao,
} from '@/db/repositories/credit-ledger-repository'
import {
  getActiveSubscriptionsOrFreePlanDao,
  getPlanByCodeDao,
} from '@/db/repositories/subscription-repository'

import {
  canConsumeService,
  completeCreditPackPurchaseService,
  consumeService,
  getBalanceService,
  getCreditBalanceService,
  getCreditPacksService,
  getRecentActivityService,
  getUsageGraphDataService,
  grantCreditsService,
} from '../credit-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {
  CreditActivityItem,
  CreditEntry,
  CreditSource,
  CreditUsageDay,
} from '../types/domain/credit-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

// Mock repositories
vi.mock('@/db/repositories/credit-ledger-repository', () => ({
  getBalanceDao: vi.fn(),
  getUsedThisPeriodDao: vi.fn(),
  getDailyUsageDao: vi.fn(),
  getRecentActivityDao: vi.fn(),
  consumeCreditsTxnDao: vi.fn(),
  allocateMonthlyCreditsTxnDao: vi.fn(),
  grantCreditsTxnDao: vi.fn(),
  addPackCreditsTxnDao: vi.fn(),
  checkAllocationExistsDao: vi.fn(),
}))

vi.mock('@/db/repositories/subscription-repository', () => ({
  getActiveSubscriptionsOrFreePlanDao: vi.fn(),
  getPlanByCodeDao: vi.fn(),
}))

const organizationId = faker.string.uuid()
const otherOrganizationId = faker.string.uuid()

const mockCreditEntry: CreditEntry = {
  id: faker.string.uuid(),
  organizationId,
  amount: 100,
  source: 'admin_grant' as CreditSource,
  sourceId: null,
  reason: 'Test grant',
  periodStart: null,
  periodEnd: null,
  expiresAt: null,
  createdAt: new Date(),
}

const mockActivity: CreditActivityItem[] = [
  {
    id: faker.string.uuid(),
    amount: 100,
    source: 'plan' as CreditSource,
    reason: 'Monthly allocation',
    createdAt: new Date(),
  },
  {
    id: faker.string.uuid(),
    amount: -10,
    source: 'usage' as CreditSource,
    reason: 'AI generation',
    createdAt: new Date(),
  },
]

const mockDailyUsage: CreditUsageDay[] = [
  {day: '2024-01-01', creditsUsed: 10},
  {day: '2024-01-02', creditsUsed: 25},
  {day: '2024-01-03', creditsUsed: 15},
]

const mockSubscription = {
  id: faker.string.uuid(),
  referenceId: organizationId,
  plan: 'pro',
  status: 'active',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-02-01'),
  limits: {credits: 1000},
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCreditPacks = [
  {
    id: faker.string.uuid(),
    code: '10tokens',
    planName: '10 Tokens',
    price: '5.00',
    priceId: 'price_10tokens',
    limits: {credits: 10},
  },
  {
    id: faker.string.uuid(),
    code: '50tokens',
    planName: '50 Tokens',
    price: '20.00',
    priceId: 'price_50tokens',
    limits: {credits: 50},
  },
  {
    id: faker.string.uuid(),
    code: '150tokens',
    planName: '150 Tokens',
    price: '50.00',
    priceId: 'price_150tokens',
    limits: {credits: 150},
  },
]

// Helper pour créer un utilisateur avec une membership
const createUserWithOrgMembership = (
  baseUser: typeof userTest | typeof userTestAdmin,
  orgId: string,
  role: (typeof UserOrganizationRoleConst)[keyof typeof UserOrganizationRoleConst]
) => ({
  ...baseUser,
  organizations: [
    {
      id: faker.string.uuid(),
      createdAt: new Date(),
      userId: baseUser.id,
      organizationId: orgId,
      role,
      joinedAt: new Date(),
      organization: {
        id: orgId,
        name: 'Test Organization',
        slug: 'test-organization',
        description: 'Test',
        logo: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ],
})

// ========================================
// ADMIN TESTS
// ========================================

describe('[ADMIN] Credit Service', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()
    vi.mocked(getBalanceDao).mockResolvedValue(500)
    vi.mocked(getUsedThisPeriodDao).mockResolvedValue(200)
    vi.mocked(getDailyUsageDao).mockResolvedValue(mockDailyUsage)
    vi.mocked(getRecentActivityDao).mockResolvedValue(mockActivity)
    vi.mocked(getActiveSubscriptionsOrFreePlanDao).mockResolvedValue([
      mockSubscription,
    ])
    vi.mocked(consumeCreditsTxnDao).mockResolvedValue({
      ...mockCreditEntry,
      amount: -50,
      source: 'usage',
    })
    vi.mocked(grantCreditsTxnDao).mockResolvedValue(mockCreditEntry)
    vi.mocked(addPackCreditsTxnDao).mockResolvedValue({
      ...mockCreditEntry,
      source: 'pack',
    })
    vi.mocked(checkAllocationExistsDao).mockResolvedValue(true)
    vi.mocked(getPlanByCodeDao).mockImplementation(async (code: string) => {
      return mockCreditPacks.find((p) => p.code === code)
    })
  })

  describe('Read Operations', () => {
    it('should get balance', async () => {
      const balance = await getBalanceService(organizationId)

      expect(balance).toBe(500)
      expect(getBalanceDao).toHaveBeenCalledWith(organizationId)
    })

    it('should get full credit balance DTO', async () => {
      const balanceDTO = await getCreditBalanceService(organizationId)

      expect(balanceDTO.available).toBe(500)
      expect(balanceDTO.balance).toBe(500)
      expect(balanceDTO.usedThisPeriod).toBe(200)
      expect(balanceDTO.monthlyAllocation).toBe(1000)
      expect(balanceDTO.periodStart).toBeInstanceOf(Date)
      expect(balanceDTO.periodEnd).toBeInstanceOf(Date)
    })

    it('should get usage graph data', async () => {
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await getUsageGraphDataService(
        organizationId,
        periodStart,
        periodEnd
      )

      expect(result).toEqual(mockDailyUsage)
      expect(getDailyUsageDao).toHaveBeenCalledWith(
        organizationId,
        periodStart,
        periodEnd
      )
    })

    it('should get recent activity', async () => {
      const result = await getRecentActivityService(organizationId, 10)

      expect(result).toEqual(mockActivity)
      expect(getRecentActivityDao).toHaveBeenCalledWith(organizationId, 10)
    })
  })

  describe('Consume Operations', () => {
    it('should consume credits', async () => {
      const result = await consumeService(organizationId, 50, 'AI generation')

      expect(result.amount).toBe(-50)
      expect(result.source).toBe('usage')
      expect(consumeCreditsTxnDao).toHaveBeenCalledWith(
        organizationId,
        50,
        'AI generation'
      )
    })

    it('should check if can consume credits', async () => {
      const canConsume = await canConsumeService(organizationId, 100)

      expect(canConsume).toBe(true)
      expect(getBalanceDao).toHaveBeenCalledWith(organizationId)
    })

    it('should return false if insufficient credits', async () => {
      vi.mocked(getBalanceDao).mockResolvedValue(50)

      const canConsume = await canConsumeService(organizationId, 100)

      expect(canConsume).toBe(false)
    })
  })

  describe('Grant Operations (Admin Only)', () => {
    it('should grant credits', async () => {
      const result = await grantCreditsService(organizationId, 100, {
        reason: 'Bonus credits',
      })

      expect(result).toEqual(mockCreditEntry)
      expect(grantCreditsTxnDao).toHaveBeenCalledWith({
        organizationId,
        amount: 100,
        reason: 'Bonus credits',
        expiresAt: undefined,
      })
    })

    it('should grant credits with expiration', async () => {
      const expiresAt = new Date('2024-12-31')

      await grantCreditsService(organizationId, 50, {
        reason: 'Limited bonus',
        expiresAt,
      })

      expect(grantCreditsTxnDao).toHaveBeenCalledWith({
        organizationId,
        amount: 50,
        reason: 'Limited bonus',
        expiresAt,
      })
    })
  })

  describe('Pack Operations', () => {
    it('should get credit packs', async () => {
      const packs = await getCreditPacksService()

      expect(packs).toHaveLength(3)
      expect(packs[0]).toMatchObject({
        id: '10tokens',
        name: '10 Tokens',
        credits: 10,
      })
      expect(packs[1]).toMatchObject({
        id: '50tokens',
        name: '50 Tokens',
        credits: 50,
        popular: true,
      })
    })

    it('should complete pack purchase', async () => {
      const result = await completeCreditPackPurchaseService({
        organizationId,
        packId: 'starter',
        credits: 100,
        stripeSessionId: 'cs_test_123',
      })

      expect(result.source).toBe('pack')
      expect(addPackCreditsTxnDao).toHaveBeenCalledWith({
        organizationId,
        amount: 100,
        sourceId: 'cs_test_123',
        expiresAt: undefined,
      })
    })
  })

  describe('Validation', () => {
    it('should throw on invalid organization ID', async () => {
      await expect(getBalanceService('invalid-uuid')).rejects.toThrow(
        ValidationError
      )
    })

    it('should throw on negative consume amount', async () => {
      await expect(consumeService(organizationId, -10, 'test')).rejects.toThrow(
        ValidationError
      )
    })

    it('should throw on zero grant amount', async () => {
      await expect(grantCreditsService(organizationId, 0)).rejects.toThrow(
        ValidationError
      )
    })
  })
})

// ========================================
// USER TESTS (MEMBER OF ORGANIZATION)
// ========================================

describe('[USER] Credit Service - Member of Organization', () => {
  const userWithOrg = createUserWithOrgMembership(
    userTest,
    organizationId,
    UserOrganizationRoleConst.ADMIN
  )

  beforeEach(() => {
    setupAuthUserMocked(userWithOrg)
    vi.clearAllMocks()
    vi.mocked(getBalanceDao).mockResolvedValue(300)
    vi.mocked(getUsedThisPeriodDao).mockResolvedValue(100)
    vi.mocked(getDailyUsageDao).mockResolvedValue(mockDailyUsage)
    vi.mocked(getRecentActivityDao).mockResolvedValue(mockActivity)
    vi.mocked(getActiveSubscriptionsOrFreePlanDao).mockResolvedValue([
      mockSubscription,
    ])
    vi.mocked(consumeCreditsTxnDao).mockResolvedValue({
      ...mockCreditEntry,
      amount: -20,
      source: 'usage',
    })
    vi.mocked(checkAllocationExistsDao).mockResolvedValue(true)
    vi.mocked(getPlanByCodeDao).mockImplementation(async (code: string) => {
      return mockCreditPacks.find((p) => p.code === code)
    })
  })

  describe('Read Operations (Own Org)', () => {
    it('should get own org balance', async () => {
      const balance = await getBalanceService(organizationId)

      expect(balance).toBe(300)
      expect(getBalanceDao).toHaveBeenCalledWith(organizationId)
    })

    it('should get own org credit balance DTO', async () => {
      const balanceDTO = await getCreditBalanceService(organizationId)

      expect(balanceDTO.available).toBe(300)
      expect(balanceDTO.usedThisPeriod).toBe(100)
    })

    it('should get own org usage graph', async () => {
      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-01-31')

      const result = await getUsageGraphDataService(
        organizationId,
        periodStart,
        periodEnd
      )

      expect(result).toEqual(mockDailyUsage)
    })

    it('should get own org recent activity', async () => {
      const result = await getRecentActivityService(organizationId)

      expect(result).toEqual(mockActivity)
    })
  })

  describe('Read Operations (Other Org - NOT ALLOWED)', () => {
    it('should NOT read other org balance', async () => {
      await expect(getBalanceService(otherOrganizationId)).rejects.toThrow(
        AuthorizationError
      )
      expect(getBalanceDao).not.toHaveBeenCalled()
    })

    it('should NOT read other org credit balance DTO', async () => {
      await expect(
        getCreditBalanceService(otherOrganizationId)
      ).rejects.toThrow(AuthorizationError)
    })

    it('should NOT read other org usage graph', async () => {
      await expect(
        getUsageGraphDataService(
          otherOrganizationId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        )
      ).rejects.toThrow(AuthorizationError)
    })

    it('should NOT read other org activity', async () => {
      await expect(
        getRecentActivityService(otherOrganizationId)
      ).rejects.toThrow(AuthorizationError)
    })
  })

  describe('Consume Operations (Own Org)', () => {
    it('should consume own org credits', async () => {
      const result = await consumeService(organizationId, 20, 'Test usage')

      expect(result.amount).toBe(-20)
      expect(consumeCreditsTxnDao).toHaveBeenCalledWith(
        organizationId,
        20,
        'Test usage'
      )
    })

    it('should check can consume own org credits', async () => {
      const canConsume = await canConsumeService(organizationId, 50)

      expect(canConsume).toBe(true)
    })
  })

  describe('Consume Operations (Other Org - NOT ALLOWED)', () => {
    it('should NOT consume other org credits', async () => {
      await expect(
        consumeService(otherOrganizationId, 20, 'Test')
      ).rejects.toThrow(AuthorizationError)
      expect(consumeCreditsTxnDao).not.toHaveBeenCalled()
    })
  })

  describe('Grant Operations (NOT ALLOWED for regular users)', () => {
    it('should NOT grant credits', async () => {
      await expect(
        grantCreditsService(organizationId, 100, {reason: 'Test'})
      ).rejects.toThrow(AuthorizationError)
      expect(grantCreditsTxnDao).not.toHaveBeenCalled()
    })
  })

  describe('Pack Operations', () => {
    it('should get credit packs (public)', async () => {
      const packs = await getCreditPacksService()

      expect(packs).toHaveLength(3)
      expect(packs[0].id).toBe('10tokens')
    })
  })
})

// ========================================
// USER TESTS (NOT MEMBER OF ORGANIZATION)
// ========================================

describe('[USER] Credit Service - Not Member of Organization', () => {
  const userNotInOrg = {
    ...userTest,
    organizations: [], // No organizations
  }

  beforeEach(() => {
    setupAuthUserMocked(userNotInOrg)
    vi.clearAllMocks()
  })

  describe('Read Operations (NOT ALLOWED)', () => {
    it('should NOT read org balance', async () => {
      await expect(getBalanceService(organizationId)).rejects.toThrow(
        AuthorizationError
      )
      expect(getBalanceDao).not.toHaveBeenCalled()
    })

    it('should NOT read org credit balance DTO', async () => {
      await expect(getCreditBalanceService(organizationId)).rejects.toThrow(
        AuthorizationError
      )
    })

    it('should NOT read org usage graph', async () => {
      await expect(
        getUsageGraphDataService(
          organizationId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        )
      ).rejects.toThrow(AuthorizationError)
    })

    it('should NOT read org activity', async () => {
      await expect(getRecentActivityService(organizationId)).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('Consume Operations (NOT ALLOWED)', () => {
    it('should NOT consume org credits', async () => {
      await expect(consumeService(organizationId, 20, 'Test')).rejects.toThrow(
        AuthorizationError
      )
      expect(consumeCreditsTxnDao).not.toHaveBeenCalled()
    })
  })
})

// ========================================
// PUBLIC (NOT AUTHENTICATED) TESTS
// ========================================

describe('[PUBLIC] Credit Service', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
    vi.mocked(getPlanByCodeDao).mockImplementation(async (code: string) => {
      return mockCreditPacks.find((p) => p.code === code)
    })
  })

  describe('Read Operations (NOT ALLOWED)', () => {
    it('should NOT get balance', async () => {
      await expect(getBalanceService(organizationId)).rejects.toThrow(
        AuthorizationError
      )
      expect(getBalanceDao).not.toHaveBeenCalled()
    })

    it('should NOT get credit balance DTO', async () => {
      await expect(getCreditBalanceService(organizationId)).rejects.toThrow(
        AuthorizationError
      )
    })

    it('should NOT get usage graph', async () => {
      await expect(
        getUsageGraphDataService(
          organizationId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        )
      ).rejects.toThrow(AuthorizationError)
    })

    it('should NOT get recent activity', async () => {
      await expect(getRecentActivityService(organizationId)).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('Consume Operations (NOT ALLOWED)', () => {
    it('should NOT consume credits', async () => {
      await expect(consumeService(organizationId, 10, 'Test')).rejects.toThrow(
        AuthorizationError
      )
      expect(consumeCreditsTxnDao).not.toHaveBeenCalled()
    })
  })

  describe('Grant Operations (NOT ALLOWED)', () => {
    it('should NOT grant credits', async () => {
      await expect(grantCreditsService(organizationId, 100)).rejects.toThrow(
        AuthorizationError
      )
      expect(grantCreditsTxnDao).not.toHaveBeenCalled()
    })
  })

  describe('Pack Operations (PUBLIC)', () => {
    it('should get credit packs', async () => {
      const packs = await getCreditPacksService()

      expect(packs).toHaveLength(3)
      expect(packs[0].id).toBe('10tokens')
    })
  })
})

// ========================================
// WEBHOOK / SYSTEM OPERATIONS
// ========================================

describe('[SYSTEM] Credit Service - Webhook Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(addPackCreditsTxnDao).mockResolvedValue({
      ...mockCreditEntry,
      source: 'pack',
    })
  })

  describe('Complete Pack Purchase (System)', () => {
    it('should complete pack purchase without auth check', async () => {
      const result = await completeCreditPackPurchaseService({
        organizationId,
        packId: 'pro',
        credits: 500,
        stripeSessionId: 'cs_test_abc123',
      })

      expect(result.source).toBe('pack')
      expect(addPackCreditsTxnDao).toHaveBeenCalledWith({
        organizationId,
        amount: 500,
        sourceId: 'cs_test_abc123',
        expiresAt: undefined,
      })
    })

    it('should set expiration for packs with expiresInDays', async () => {
      await completeCreditPackPurchaseService({
        organizationId,
        packId: 'promo',
        credits: 100,
        stripeSessionId: 'cs_test_promo',
        expiresInDays: 30,
      })

      expect(addPackCreditsTxnDao).toHaveBeenCalledWith({
        organizationId,
        amount: 100,
        sourceId: 'cs_test_promo',
        expiresAt: expect.any(Date),
      })
    })
  })
})
