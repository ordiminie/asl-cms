import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : chaque cas pose son propre compte.
 * Ces actions convertissent le refus en résultat d'échec.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
vi.mock('@/services/facades/organization-service-facade', () => ({}))
vi.mock('@/services/facades/subscription-service-facade', () => ({
  createPlanService: vi.fn(),
  deletePlanService: vi.fn(),
  softDeletePlanService: vi.fn(),
  updatePlanService: vi.fn(),
}))

import {getAuthUser} from '@/services/authentication/auth-service'
import {
  createPlanService,
  deletePlanService,
  softDeletePlanService,
  updatePlanService,
} from '@/services/facades/subscription-service-facade'

import {
  createPlanAction,
  deletePlanAction,
  softDeletePlanAction,
  updatePlanAction,
} from './actions'

const PLAN_ID = '11111111-1111-4111-8111-111111111111'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const plan = {
  code: 'pro',
  planName: 'Pro',
  priceId: 'price_123',
  price: '10',
}

const cases = [
  {
    name: 'createPlanAction',
    call: () => createPlanAction(plan as never),
    service: createPlanService,
  },
  {
    name: 'updatePlanAction',
    call: () => updatePlanAction({id: PLAN_ID, ...plan} as never),
    service: updatePlanService,
  },
  {
    name: 'softDeletePlanAction',
    call: () => softDeletePlanAction(PLAN_ID),
    service: softDeletePlanService,
  },
  {
    name: 'deletePlanAction',
    call: () => deletePlanAction(PLAN_ID),
    service: deletePlanService,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('actions de /admin/plans — réservées au SuperAdmin (s47)', () => {
  it.each(cases)(
    '[USER] $name refuse un compte user sans appeler le service',
    async ({call, service}) => {
      vi.mocked(getAuthUser).mockResolvedValue(account('user'))

      const result = await call()

      expect(result.success).toBe(false)
      expect(service).not.toHaveBeenCalled()
    }
  )

  it.each(cases)(
    '[SUPER_ADMIN] $name atteint son service',
    async ({call, service}) => {
      vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))

      const result = await call()

      expect(result.success).toBe(true)
      expect(service).toHaveBeenCalledTimes(1)
    }
  )
})
