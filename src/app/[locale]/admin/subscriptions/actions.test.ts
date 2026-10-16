import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : chaque cas pose son propre compte.
 * Ces actions convertissent le refus en résultat d'échec.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({cacheLife: vi.fn(), revalidatePath: vi.fn()}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
vi.mock('@/services/facades/organization-service-facade', () => ({}))
vi.mock('@/services/facades/subscription-service-facade', () => ({
  cancelSubscriptionAdminService: vi.fn(),
  reactivateSubscriptionAdminService: vi.fn(),
}))

import {getAuthUser} from '@/services/authentication/auth-service'
import {
  cancelSubscriptionAdminService,
  reactivateSubscriptionAdminService,
} from '@/services/facades/subscription-service-facade'

import {cancelSubscriptionAction, reactivateSubscriptionAction} from './actions'

const SUBSCRIPTION_ID = 'sub_123'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const cases = [
  {
    name: 'cancelSubscriptionAction',
    call: () => cancelSubscriptionAction(SUBSCRIPTION_ID),
    service: cancelSubscriptionAdminService,
  },
  {
    name: 'reactivateSubscriptionAction',
    call: () => reactivateSubscriptionAction(SUBSCRIPTION_ID),
    service: reactivateSubscriptionAdminService,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('actions de /admin/subscriptions — réservées au SuperAdmin (s47)', () => {
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
      expect(service).toHaveBeenCalledWith(SUBSCRIPTION_ID)
    }
  )
})
