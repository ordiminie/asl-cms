import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : chaque cas pose son propre compte.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({cacheLife: vi.fn(), revalidatePath: vi.fn()}))
vi.mock('next/headers', () => ({headers: vi.fn(async () => new Headers())}))
vi.mock('@/lib/auth', () => ({
  auth: {api: {banUser: vi.fn(), unbanUser: vi.fn()}},
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/organization-service-facade', () => ({}))
vi.mock('@/services/facades/user-service-facade', () => ({
  getAllUsersWithPaginationService: vi.fn(),
  updateUserService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {auth} from '@/lib/auth'
import {getAuthUser} from '@/services/authentication/auth-service'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  getAllUsersWithPaginationService,
  updateUserService,
} from '@/services/facades/user-service-facade'

import {
  deleteUserAction,
  fetchUsersAction,
  updateUserAction,
  updateUserDetailAction,
} from './actions'

const USER_ID = '11111111-1111-4111-8111-111111111111'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const okResponse = () =>
  ({ok: true, status: 200, text: async () => ''}) as unknown as Response

const userForm = () => {
  const formData = new FormData()
  formData.set('name', 'Bob')
  formData.set('email', 'bob@asl.test')
  formData.set('visibility', 'private')
  return formData
}

const detail = (role: string) => ({
  name: 'Bob',
  email: 'bob@asl.test',
  role,
  visibility: 'private' as const,
  banned: false,
  twoFactorEnabled: false,
  emailVerified: true,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.banUser).mockResolvedValue(okResponse() as never)
  vi.mocked(auth.api.unbanUser).mockResolvedValue(okResponse() as never)
  vi.mocked(getAllUsersWithPaginationService).mockResolvedValue({
    data: [],
    pagination: {total: 0},
  } as never)
})

describe('actions de /admin/users — réservées au SuperAdmin (s47)', () => {
  describe('[USER] un compte user est refusé', () => {
    beforeEach(() => {
      vi.mocked(getAuthUser).mockResolvedValue(account('user'))
    })

    it('updateUserAction refuse sans appeler le service', async () => {
      await expect(
        updateUserAction(USER_ID, undefined, userForm())
      ).rejects.toThrow(AuthorizationError)
      expect(updateUserService).not.toHaveBeenCalled()
    })

    it('updateUserDetailAction refuse sans appeler le service ni Better Auth', async () => {
      await expect(
        updateUserDetailAction(USER_ID, detail('user'))
      ).rejects.toThrow(AuthorizationError)
      expect(updateUserService).not.toHaveBeenCalled()
      expect(auth.api.unbanUser).not.toHaveBeenCalled()
    })

    it('deleteUserAction refuse sans rien invalider', async () => {
      await expect(deleteUserAction(USER_ID)).rejects.toThrow(
        AuthorizationError
      )
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('fetchUsersAction refuse sans appeler le service', async () => {
      const result = await fetchUsersAction({limit: 10, offset: 0})

      expect(result.success).toBe(false)
      expect(getAllUsersWithPaginationService).not.toHaveBeenCalled()
    })
  })

  describe('[SUPER_ADMIN] le SuperAdmin atteint chaque action', () => {
    beforeEach(() => {
      vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))
    })

    it('updateUserAction atteint son service', async () => {
      const result = await updateUserAction(USER_ID, undefined, userForm())

      expect(result.success).toBe(true)
      expect(updateUserService).toHaveBeenCalledTimes(1)
    })

    it('updateUserDetailAction atteint son service et Better Auth', async () => {
      const result = await updateUserDetailAction(USER_ID, detail('user'))

      expect(result.success).toBe(true)
      expect(updateUserService).toHaveBeenCalledTimes(1)
      expect(auth.api.unbanUser).toHaveBeenCalledTimes(1)
    })

    it('deleteUserAction (placeholder) passe la garde', async () => {
      const result = await deleteUserAction(USER_ID)

      expect(result.success).toBe(true)
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('fetchUsersAction atteint son service', async () => {
      const result = await fetchUsersAction({limit: 10, offset: 0})

      expect(result.success).toBe(true)
      expect(getAllUsersWithPaginationService).toHaveBeenCalledTimes(1)
    })
  })
})

/** s47, critère 2 : le serveur refuse un rôle global retiré. */
describe('updateUserDetailAction — rôle global', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))
  })

  it.each(['admin', 'moderator', 'redactor', 'public'])(
    'refuse le rôle retiré %s sans rien écrire ni appeler Better Auth',
    async (role) => {
      const result = await updateUserDetailAction(USER_ID, detail(role))

      expect(result.success).toBe(false)
      expect(updateUserService).not.toHaveBeenCalled()
      expect(auth.api.banUser).not.toHaveBeenCalled()
      expect(auth.api.unbanUser).not.toHaveBeenCalled()
    }
  )

  it('accepte super_admin', async () => {
    const result = await updateUserDetailAction(USER_ID, detail('super_admin'))

    expect(result.success).toBe(true)
    expect(updateUserService).toHaveBeenCalledWith(
      expect.objectContaining({role: 'super_admin'})
    )
  })
})
