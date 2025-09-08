import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
  // Plans repositories
  createPlanDao,
  createSubscriptionDao,
  deletePlanDao,
  getActivePlansDao,
  getActiveSubscriptionsByUserIdDao,
  getPlanByCodeDao,
  getPlanByIdDao,
  getPlanByPriceIdDao,
  getPlansWithPaginationDao,
  getSubscriptionByIdDao,
  isActivePlanExistDao,
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
} from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  // Plans services
  createPlanService,
  createSubscriptionFromStripeService,
  createSubscriptionService,
  deletePlanService,
  getActivePlansService,
  getActiveSubscriptionsByUserIdService,
  getPlanByCodeService,
  getPlanByIdService,
  getPlanByPriceIdService,
  getPlansWithPaginationService,
  getSubscriptionByIdService,
  isPlanNameExistService,
  isPriceIdExistService,
  softDeletePlanService,
  updatePlanService,
  updateSubscriptionService,
} from '../subscription-service'
import {PaginatedResponse} from '../types/common-type'
import {Plan, Subscription} from '../types/domain/subscription-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

// Mock repositories
vi.mock('@/db/repositories/subscription-repository', () => ({
  createSubscriptionDao: vi.fn(),
  getSubscriptionByIdDao: vi.fn(),
  updateSubscriptionDao: vi.fn(),
  isPlanExistDao: vi.fn(),
  isActivePlanExistDao: vi.fn(),
  getActiveSubscriptionsByUserIdDao: vi.fn(),
  getSubscriptionByUserIdDao: vi.fn(),
  isPlanAndStripeSubscriptionExistDao: vi.fn(),
  // Plans repositories
  createPlanDao: vi.fn(),
  getPlanByIdDao: vi.fn(),
  getPlanByCodeDao: vi.fn(),
  getPlanByPriceIdDao: vi.fn(),
  getActivePlansDao: vi.fn(),
  getPlansWithPaginationDao: vi.fn(),
  updatePlanDao: vi.fn(),
  softDeletePlanDao: vi.fn(),
  deletePlanDao: vi.fn(),
  isPlanNameExistDao: vi.fn(),
  isPriceIdExistDao: vi.fn(),
}))

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
  getUserByIdDao: vi.fn(),
}))

describe('[ADMIN] CRUD : Subscription Service', () => {
  const subscriptionId = faker.string.uuid()
  const subscriptionData: Subscription = {
    id: subscriptionId,
    referenceId: userTestAdmin.id,
    plan: 'pro',
    status: 'active',
    periodStart: new Date(),
    periodEnd: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    trialStart: new Date(),
    trialEnd: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: 'sub_123',
    cancelAtPeriodEnd: false,
    seats: 1,
  }

  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()
    vi.mocked(createSubscriptionDao).mockResolvedValue(subscriptionData)
    vi.mocked(getSubscriptionByIdDao).mockResolvedValue(subscriptionData)
    vi.mocked(updateSubscriptionDao).mockResolvedValue(subscriptionData)
  })

  it('should create a new subscription', async () => {
    const createData = {
      referenceId: userTestAdmin.id,
      plan: 'pro',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
    }
    const result = await createSubscriptionService(createData)

    expect(result).toEqual(subscriptionData)
    expect(createSubscriptionDao).toHaveBeenCalledWith({
      ...createData,
      quantity: 1, // Zod v4 ajoute automatiquement les valeurs par défaut
    })
  })

  it('should get a subscription by id', async () => {
    const result = await getSubscriptionByIdService(subscriptionId)

    expect(result).toEqual(subscriptionData)
    expect(getSubscriptionByIdDao).toHaveBeenCalledWith(subscriptionId)
  })

  it('should update a subscription', async () => {
    const updateData = {
      id: subscriptionId,
      referenceId: userTestAdmin.id,
      plan: 'lifetime',
      status: 'active',
    }
    const result = await updateSubscriptionService(updateData)

    expect(result).toEqual(subscriptionData)
    expect(updateSubscriptionDao).toHaveBeenCalledWith(
      subscriptionId,
      updateData
    )
  })
})

describe('[USER] CRUD : Subscription Service', () => {
  const subscriptionId = faker.string.uuid()
  const authUserId = userTest.id
  const subscriptionData: Subscription = {
    id: subscriptionId,
    referenceId: authUserId,
    plan: 'pro',
    status: 'active',
    periodStart: new Date(),
    periodEnd: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    trialStart: new Date(),
    trialEnd: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: 'sub_123',
    cancelAtPeriodEnd: false,
    seats: 1,
  }

  beforeEach(() => {
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()
    vi.mocked(createSubscriptionDao).mockResolvedValue(subscriptionData)
    vi.mocked(getSubscriptionByIdDao).mockResolvedValue({
      ...subscriptionData,
      referenceId: 'other-user',
    })
    vi.mocked(updateSubscriptionDao).mockResolvedValue(subscriptionData)
  })

  it('should create own subscription', async () => {
    const createData = {
      referenceId: authUserId,
      plan: 'pro',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
    }
    const result = await createSubscriptionService(createData)

    expect(result).toEqual(subscriptionData)
    expect(createSubscriptionDao).toHaveBeenCalledWith({
      ...createData,
      quantity: 1, // Zod v4 ajoute automatiquement les valeurs par défaut
    })
  })

  it("should NOT read another user's subscription", async () => {
    await expect(getSubscriptionByIdService(subscriptionId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getSubscriptionByIdDao).toHaveBeenCalledWith(subscriptionId)
  })

  it("should NOT update another user's subscription", async () => {
    const updateData = {
      id: subscriptionId,
      referenceId: authUserId,
      plan: 'lifetime',
    }
    await expect(updateSubscriptionService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updateSubscriptionDao).not.toHaveBeenCalled()
  })

  it('should read own subscription', async () => {
    vi.mocked(getSubscriptionByIdDao).mockResolvedValue({
      ...subscriptionData,
      referenceId: authUserId,
    })
    const result = await getSubscriptionByIdService(subscriptionId)
    expect(result).toEqual({...subscriptionData, referenceId: authUserId})
  })

  it('should update own subscription', async () => {
    vi.mocked(getSubscriptionByIdDao).mockResolvedValue({
      ...subscriptionData,
      referenceId: authUserId,
    })
    const updateData = {
      id: subscriptionId,
      referenceId: authUserId,
      plan: 'lifetime',
    }
    const result = await updateSubscriptionService(updateData)
    expect(result).toEqual(subscriptionData)
    expect(updateSubscriptionDao).toHaveBeenCalledWith(
      subscriptionId,
      updateData
    )
  })
})

describe('[PUBLIC] CRUD : Subscription Service', () => {
  const subscriptionId = faker.string.uuid()

  beforeEach(() => {
    setupAuthUserMocked()
    vi.clearAllMocks()
  })

  it('should NOT access subscriptions', async () => {
    await expect(getSubscriptionByIdService(subscriptionId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getSubscriptionByIdDao).not.toHaveBeenCalled()
  })
})

describe('[STRIPE] Webhook Subscription Service', () => {
  const subscriptionId = faker.string.uuid()
  const testEmail = 'test@example.com'
  const testUser = {
    ...userTest,
    email: testEmail,
    stripeCustomerId: 'cus_stripe123',
  }
  const subscriptionData: Subscription = {
    id: subscriptionId,
    referenceId: testUser.id,
    plan: 'pro',
    status: 'active',
    periodStart: new Date(),
    periodEnd: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    trialStart: new Date(),
    trialEnd: new Date(),
    stripeCustomerId: testUser.stripeCustomerId,
    stripeSubscriptionId: 'sub_123',
    cancelAtPeriodEnd: false,
    seats: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserByEmailDao).mockResolvedValue(testUser)
    vi.mocked(createSubscriptionDao).mockResolvedValue(subscriptionData)
    vi.mocked(isPlanExistDao).mockResolvedValue(false)
    vi.mocked(isActivePlanExistDao).mockResolvedValue(false)
  })

  it('should create PRO subscription', async () => {
    const result = await createSubscriptionFromStripeService(
      testEmail,
      'pro',
      false
    )

    expect(result).toEqual(subscriptionData)
    expect(getUserByEmailDao).toHaveBeenCalledWith(testEmail)
    // expect(isActivePlanExistDao).toHaveBeenCalledWith(
    //   testUser.stripeCustomerId,
    //   'pro'
    // )
    expect(createSubscriptionDao).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: testUser.id,
        plan: 'pro',
        status: 'active',
        periodStart: expect.any(Date),
        periodEnd: expect.any(Date),
        stripeCustomerId: testUser.stripeCustomerId,
      })
    )
  })

  it('should create LIFETIME subscription', async () => {
    const result = await createSubscriptionFromStripeService(
      testEmail,
      'lifetime',
      true
    )

    expect(result).toEqual(subscriptionData)
    expect(getUserByEmailDao).toHaveBeenCalledWith(testEmail)
    // expect(isActivePlanExistDao).toHaveBeenCalledWith(
    //   testUser.stripeCustomerId,
    //   'lifetime'
    // )
    expect(createSubscriptionDao).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: testUser.id,
        plan: 'lifetime',
        status: 'active',
        periodStart: expect.any(Date),
        periodEnd: undefined, // Lifetime = pas de fin
        stripeCustomerId: testUser.stripeCustomerId,
      })
    )
  })

  it.skip('should throw error when plan already exists', async () => {
    vi.mocked(isActivePlanExistDao).mockResolvedValue(true)

    await expect(
      createSubscriptionFromStripeService(testEmail, 'pro', false)
    ).rejects.toThrow('User already has an active pro subscription')

    expect(createSubscriptionDao).not.toHaveBeenCalled()
  })

  it('should throw error when user email not found', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)

    await expect(
      createSubscriptionFromStripeService(testEmail, 'pro', true)
    ).rejects.toThrow('User not found')

    expect(createSubscriptionDao).not.toHaveBeenCalled()
  })
})

describe('[USER] Active Subscriptions Service', () => {
  const subscriptionData: Subscription = {
    id: faker.string.uuid(),
    referenceId: userTest.id,
    plan: 'pro',
    status: 'active',
    periodStart: new Date(),
    periodEnd: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    trialStart: new Date(),
    trialEnd: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: 'sub_123',
    cancelAtPeriodEnd: false,
    seats: 1,
  }

  const activeSubscriptions = [
    {
      ...subscriptionData,
      id: faker.string.uuid(),
      plan: 'pro',
    },
    {
      ...subscriptionData,
      id: faker.string.uuid(),
      plan: 'lifetime',
    },
  ]

  beforeEach(() => {
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()
    vi.mocked(getUserByIdDao).mockResolvedValue(userTest)
    vi.mocked(getSubscriptionByIdDao).mockResolvedValue(subscriptionData)
    vi.mocked(getActiveSubscriptionsByUserIdDao).mockResolvedValue(
      activeSubscriptions
    )
  })

  it('should get active subscriptions for user', async () => {
    const result = await getActiveSubscriptionsByUserIdService(userTest.id)

    expect(result).toEqual(activeSubscriptions)
    expect(getActiveSubscriptionsByUserIdDao).toHaveBeenCalledWith(userTest.id)
  })

  it('should throw error when user not found', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(undefined)

    await expect(
      getActiveSubscriptionsByUserIdService('non-existent-id')
    ).rejects.toThrow('User not found')

    expect(getActiveSubscriptionsByUserIdDao).not.toHaveBeenCalled()
  })

  it('should throw error when user has no permission', async () => {
    setupAuthUserMocked() // Utilisateur non connecté

    await expect(
      getActiveSubscriptionsByUserIdService(userTest.id)
    ).rejects.toThrow(AuthorizationError)
  })

  it('should return empty array when user has no active subscriptions', async () => {
    vi.mocked(getActiveSubscriptionsByUserIdDao).mockResolvedValue([])

    const result = await getActiveSubscriptionsByUserIdService(userTest.id)

    expect(result).toEqual([])
    expect(getActiveSubscriptionsByUserIdDao).toHaveBeenCalledWith(userTest.id)
  })
})

// ========================================
// TESTS POUR LES PLANS
// ========================================

describe('[ADMIN] CRUD : Plan Service', () => {
  const planId = faker.string.uuid()
  const planData: Plan = {
    id: planId,
    code: 'pro',
    priceId: 'price_pro_monthly',
    annualDiscountPriceId: 'price_pro_yearly',
    planName: 'Pro',
    description: 'Plan professionnel',
    limits: {
      projects: 2,
      storage: 10,
    },
    freeTrial: {
      days: 14,
    },
    features: ['Feature 1', 'Feature 2'],
    price: '29.00',
    yearlyPrice: '249.00',
    currency: 'EUR',
    isRecurring: true,
    status: 'active',
    version: 1,
    isLegacy: false,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const paginationData = {
    limit: 10,
    offset: 0,
  }

  const paginatedResponse: PaginatedResponse<Plan> = {
    data: [planData],
    pagination: {
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    },
  }

  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()
    vi.mocked(createPlanDao).mockResolvedValue(planData)
    vi.mocked(getPlanByIdDao).mockResolvedValue(planData)
    vi.mocked(getPlanByCodeDao).mockResolvedValue(planData)
    vi.mocked(getPlanByPriceIdDao).mockResolvedValue(planData)
    vi.mocked(getActivePlansDao).mockResolvedValue([planData])
    vi.mocked(getPlansWithPaginationDao).mockResolvedValue(paginatedResponse)
    vi.mocked(updatePlanDao).mockResolvedValue(planData)
    vi.mocked(softDeletePlanDao).mockResolvedValue()
    vi.mocked(deletePlanDao).mockResolvedValue()
    vi.mocked(isPlanNameExistDao).mockResolvedValue(false)
    vi.mocked(isPriceIdExistDao).mockResolvedValue(false)
  })

  it('should create a new plan', async () => {
    const createData = {
      code: 'pro',
      priceId: 'price_pro_monthly',
      planName: 'Pro',
    }
    const result = await createPlanService(createData)

    expect(result).toEqual(planData)
    expect(createPlanDao).toHaveBeenCalledWith({
      ...createData,
      isRecurring: true, // Le schéma ajoute cette propriété par défaut
    })
  })

  it('should get a plan by id', async () => {
    const result = await getPlanByIdService(planId)

    expect(result).toEqual(planData)
    expect(getPlanByIdDao).toHaveBeenCalledWith(planId)
  })

  it('should get a plan by name', async () => {
    const result = await getPlanByCodeService('pro')

    expect(result).toEqual(planData)
    expect(getPlanByCodeDao).toHaveBeenCalledWith('pro')
  })

  it('should get a plan by priceId', async () => {
    const result = await getPlanByPriceIdService('price_pro_monthly')

    expect(result).toEqual(planData)
    expect(getPlanByPriceIdDao).toHaveBeenCalledWith('price_pro_monthly')
  })

  it('should get all active plans', async () => {
    const result = await getActivePlansService()

    expect(result).toEqual([planData])
    expect(getActivePlansDao).toHaveBeenCalledWith()
  })

  it('should get plans with pagination', async () => {
    const result = await getPlansWithPaginationService(paginationData)

    expect(result).toEqual(paginatedResponse)
    expect(getPlansWithPaginationDao).toHaveBeenCalledWith(
      paginationData,
      undefined
    )
  })

  it('should update a plan', async () => {
    const updateData = {
      id: planId,
      planName: 'Pro Updated',
      description: 'Updated description',
    }
    const result = await updatePlanService(updateData)

    expect(result).toEqual(planData)
    expect(updatePlanDao).toHaveBeenCalledWith(planId, updateData)
  })

  it('should soft delete a plan', async () => {
    await softDeletePlanService(planId)

    expect(softDeletePlanDao).toHaveBeenCalledWith(planId)
  })

  it('should delete a plan permanently', async () => {
    await deletePlanService(planId)

    expect(deletePlanDao).toHaveBeenCalledWith(planId)
  })

  it('should check if plan name exists', async () => {
    const result = await isPlanNameExistService('pro')

    expect(result).toBe(false)
    expect(isPlanNameExistDao).toHaveBeenCalledWith('pro')
  })

  it('should check if priceId exists', async () => {
    const result = await isPriceIdExistService('price_pro_monthly')

    expect(result).toBe(false)
    expect(isPriceIdExistDao).toHaveBeenCalledWith('price_pro_monthly')
  })
})

describe('[USER] CRUD : Plan Service', () => {
  const planId = faker.string.uuid()
  const planData: Plan = {
    id: planId,
    code: 'pro',
    priceId: 'price_pro_monthly',
    annualDiscountPriceId: 'price_pro_yearly',
    planName: 'Pro',
    description: 'Plan professionnel',
    limits: {
      projects: 2,
      storage: 10,
    },
    freeTrial: {
      days: 14,
    },
    features: ['Feature 1', 'Feature 2'],
    price: '29.00',
    yearlyPrice: '249.00',
    currency: 'EUR',
    isRecurring: true,
    status: 'active',
    version: 1,
    isLegacy: false,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const paginationData = {
    limit: 10,
    offset: 0,
  }

  beforeEach(() => {
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()
    vi.mocked(getPlanByIdDao).mockResolvedValue(planData)
    vi.mocked(getPlanByCodeDao).mockResolvedValue(planData)
    vi.mocked(getPlanByPriceIdDao).mockResolvedValue(planData)
    vi.mocked(getActivePlansDao).mockResolvedValue([planData])
    vi.mocked(getPlansWithPaginationDao).mockResolvedValue({
      data: [planData],
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })
    vi.mocked(isPlanNameExistDao).mockResolvedValue(false)
    vi.mocked(isPriceIdExistDao).mockResolvedValue(false)
  })

  it('should get a plan by id', async () => {
    const result = await getPlanByIdService(planId)

    expect(result).toEqual(planData)
    expect(getPlanByIdDao).toHaveBeenCalledWith(planId)
  })

  it('should get a plan by name', async () => {
    const result = await getPlanByCodeService('pro')

    expect(result).toEqual(planData)
    expect(getPlanByCodeDao).toHaveBeenCalledWith('pro')
  })

  it('should get a plan by priceId', async () => {
    const result = await getPlanByPriceIdService('price_pro_monthly')

    expect(result).toEqual(planData)
    expect(getPlanByPriceIdDao).toHaveBeenCalledWith('price_pro_monthly')
  })

  it('should get all active plans', async () => {
    const result = await getActivePlansService()

    expect(result).toEqual([planData])
    expect(getActivePlansDao).toHaveBeenCalledWith()
  })

  it('should get plans with pagination', async () => {
    const result = await getPlansWithPaginationService(paginationData)

    expect(result.data).toEqual([planData])
    expect(getPlansWithPaginationDao).toHaveBeenCalledWith(
      paginationData,
      undefined
    )
  })

  it('should check if plan name exists', async () => {
    const result = await isPlanNameExistService('pro')

    expect(result).toBe(false)
    expect(isPlanNameExistDao).toHaveBeenCalledWith('pro')
  })

  it('should check if priceId exists', async () => {
    const result = await isPriceIdExistService('price_pro_monthly')

    expect(result).toBe(false)
    expect(isPriceIdExistDao).toHaveBeenCalledWith('price_pro_monthly')
  })

  it('should NOT create a plan', async () => {
    const createData = {
      code: 'pro',
      priceId: 'price_pro_monthly',
      planName: 'Pro',
    }
    await expect(createPlanService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createPlanDao).not.toHaveBeenCalled()
  })

  it('should NOT update a plan', async () => {
    const updateData = {
      id: planId,
      planName: 'Pro Updated',
    }
    await expect(updatePlanService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updatePlanDao).not.toHaveBeenCalled()
  })

  it('should NOT soft delete a plan', async () => {
    await expect(softDeletePlanService(planId)).rejects.toThrow(
      AuthorizationError
    )
    expect(softDeletePlanDao).not.toHaveBeenCalled()
  })

  it('should NOT delete a plan permanently', async () => {
    await expect(deletePlanService(planId)).rejects.toThrow(AuthorizationError)
    expect(deletePlanDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] CRUD : Plan Service', () => {
  const planId = faker.string.uuid()
  const planData: Plan = {
    id: planId,
    code: 'pro',
    priceId: 'price_pro_monthly',
    annualDiscountPriceId: 'price_pro_yearly',
    planName: 'Pro',
    description: 'Plan professionnel',
    limits: {
      projects: 2,
      storage: 10,
    },
    freeTrial: {
      days: 14,
    },
    features: ['Feature 1', 'Feature 2'],
    price: '29.00',
    yearlyPrice: '249.00',
    currency: 'EUR',
    isRecurring: true,
    status: 'active',
    version: 1,
    isLegacy: false,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const paginationData = {
    limit: 10,
    offset: 0,
  }

  beforeEach(() => {
    setupAuthUserMocked(undefined) // Pas d'utilisateur connecté
    vi.clearAllMocks()
    // Mock des réponses pour les opérations de lecture autorisées
    vi.mocked(getPlanByIdDao).mockResolvedValue(planData)
    vi.mocked(getPlanByCodeDao).mockResolvedValue(planData)
    vi.mocked(getPlanByPriceIdDao).mockResolvedValue(planData)
    vi.mocked(getActivePlansDao).mockResolvedValue([planData])
    vi.mocked(getPlansWithPaginationDao).mockResolvedValue({
      data: [planData],
      pagination: {limit: 10, page: 1, total: 1, totalPages: 1},
    })
    vi.mocked(isPlanNameExistDao).mockResolvedValue(false)
    vi.mocked(isPriceIdExistDao).mockResolvedValue(false)
  })

  // ✅ OPÉRATIONS DE LECTURE - Maintenant autorisées pour PUBLIC
  it('should get all active plans', async () => {
    const result = await getActivePlansService()

    expect(result).toEqual([planData])
    expect(getActivePlansDao).toHaveBeenCalledWith()
  })

  it('should get plans with pagination', async () => {
    const result = await getPlansWithPaginationService(paginationData)

    expect(result.data).toEqual([planData])
    expect(getPlansWithPaginationDao).toHaveBeenCalledWith(
      paginationData,
      undefined
    )
  })

  it('should check if plan name exists', async () => {
    const result = await isPlanNameExistService('pro')

    expect(result).toBe(false)
    expect(isPlanNameExistDao).toHaveBeenCalledWith('pro')
  })

  it('should check if priceId exists', async () => {
    const result = await isPriceIdExistService('price_pro_monthly')

    expect(result).toBe(false)
    expect(isPriceIdExistDao).toHaveBeenCalledWith('price_pro_monthly')
  })

  it('should get a plan by id', async () => {
    const result = await getPlanByIdService(planId)

    expect(result).toEqual(planData)
    expect(getPlanByIdDao).toHaveBeenCalledWith(planId)
  })

  it('should get a plan by name', async () => {
    const result = await getPlanByCodeService('pro')

    expect(result).toEqual(planData)
    expect(getPlanByCodeDao).toHaveBeenCalledWith('pro')
  })

  it('should get a plan by priceId', async () => {
    const result = await getPlanByPriceIdService('price_pro_monthly')

    expect(result).toEqual(planData)
    expect(getPlanByPriceIdDao).toHaveBeenCalledWith('price_pro_monthly')
  })

  // ❌ OPÉRATIONS D'ÉCRITURE - Toujours interdites pour PUBLIC
  it('should NOT create a plan', async () => {
    const createData = {
      code: 'pro',
      priceId: 'price_pro_monthly',
      planName: 'Pro',
    }
    await expect(createPlanService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createPlanDao).not.toHaveBeenCalled()
  })

  it('should NOT update a plan', async () => {
    const updateData = {
      id: planId,
      planName: 'Pro Updated',
    }
    await expect(updatePlanService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updatePlanDao).not.toHaveBeenCalled()
  })

  it('should NOT soft delete a plan', async () => {
    await expect(softDeletePlanService(planId)).rejects.toThrow(
      AuthorizationError
    )
    expect(softDeletePlanDao).not.toHaveBeenCalled()
  })

  it('should NOT delete a plan permanently', async () => {
    await expect(deletePlanService(planId)).rejects.toThrow(AuthorizationError)
    expect(deletePlanDao).not.toHaveBeenCalled()
  })
})
