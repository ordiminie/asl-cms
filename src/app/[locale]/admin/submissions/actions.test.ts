import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : chaque cas pose son propre compte.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({cacheLife: vi.fn(), revalidatePath: vi.fn()}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  withCurrentTenant: vi.fn(
    async (callback: () => Promise<unknown>) => await callback()
  ),
}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
vi.mock('@/services/facades/organization-service-facade', () => ({}))
vi.mock('@/services/facades/user-submission-service-facade', () => ({
  archiveUserSubmissionService: vi.fn(),
  markAsReadService: vi.fn(),
}))

import {getAuthUser} from '@/services/authentication/auth-service'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  archiveUserSubmissionService,
  markAsReadService,
} from '@/services/facades/user-submission-service-facade'

import {archiveSubmissionAction, markAsReadAction} from './actions'

const SUBMISSION_ID = '11111111-1111-4111-8111-111111111111'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const cases = [
  {
    name: 'markAsReadAction',
    call: () => markAsReadAction(SUBMISSION_ID),
    service: markAsReadService,
  },
  {
    name: 'archiveSubmissionAction',
    call: () => archiveSubmissionAction(SUBMISSION_ID),
    service: archiveUserSubmissionService,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('actions de /admin/submissions — réservées au SuperAdmin (s47)', () => {
  it.each(cases)(
    '[USER] $name refuse un compte user sans appeler le service',
    async ({call, service}) => {
      vi.mocked(getAuthUser).mockResolvedValue(account('user'))

      await expect(call()).rejects.toThrow(AuthorizationError)
      expect(service).not.toHaveBeenCalled()
    }
  )

  it.each(cases)(
    '[SUPER_ADMIN] $name atteint son service',
    async ({call, service}) => {
      vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))

      const result = await call()

      expect(result.success).toBe(true)
      expect(service).toHaveBeenCalledWith(SUBMISSION_ID)
    }
  )
})
