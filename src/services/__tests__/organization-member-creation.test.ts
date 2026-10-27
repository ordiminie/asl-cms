import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/organization-repository')
vi.mock('@/db/repositories/member-role-event-repository', () => ({
  insertMemberRoleEventDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfileByUserIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))

import {
  createOrganizationMemberDao,
  getUserOrganizationDao,
} from '@/db/repositories/organization-repository'

import {ValidationError} from '../errors/validation-error'
import {createOrganizationMemberService} from '../organization-service'
import {setupAuthUserMocked} from './helper-service-test'
import {userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(userTestSuperAdmin)
  vi.mocked(getUserOrganizationDao).mockResolvedValue(undefined)
  vi.mocked(createOrganizationMemberDao).mockImplementation(
    async (params) => ({id: 'membership', ...params}) as never
  )
})

describe('createOrganizationMemberService — ajout au rôle Membre seulement (s14, ADR 039 §1)', () => {
  it('crée une appartenance au rôle member', async () => {
    await createOrganizationMemberService({
      organizationId: ORG_ID,
      userId: USER_ID,
      role: 'member',
      createdAt: new Date(),
    })

    expect(createOrganizationMemberDao).toHaveBeenCalledWith(
      expect.objectContaining({role: 'member', userId: USER_ID})
    )
  })

  it.each(['board', 'owner'] as const)(
    'refuse le rôle %s, sans écriture',
    async (role) => {
      await expect(
        createOrganizationMemberService({
          organizationId: ORG_ID,
          userId: USER_ID,
          role,
          createdAt: new Date(),
        })
      ).rejects.toThrow(ValidationError)
      expect(createOrganizationMemberDao).not.toHaveBeenCalled()
    }
  )
})
