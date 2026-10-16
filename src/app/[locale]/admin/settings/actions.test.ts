import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : chaque cas pose son propre compte.
 * L'action convertit le refus en résultat d'échec.
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
vi.mock('@/services/facades/app-settings-service-facade', () => ({
  bulkUpdateAppSettingsService: vi.fn(),
}))

import {getAuthUser} from '@/services/authentication/auth-service'
import {bulkUpdateAppSettingsService} from '@/services/facades/app-settings-service-facade'

import {updateSettingsAction} from './actions'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const settings = [{key: 'maintenance', value: 'false'}]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateSettingsAction — réservée au SuperAdmin (s47)', () => {
  it('[USER] refuse un compte user sans appeler le service', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    const result = await updateSettingsAction(settings)

    expect(result.success).toBe(false)
    expect(bulkUpdateAppSettingsService).not.toHaveBeenCalled()
  })

  it('[SUPER_ADMIN] atteint son service', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))

    const result = await updateSettingsAction(settings)

    expect(result.success).toBe(true)
    expect(bulkUpdateAppSettingsService).toHaveBeenCalledWith(
      settings,
      'super_admin-1'
    )
  })
})
