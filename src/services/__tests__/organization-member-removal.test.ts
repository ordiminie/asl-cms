import {beforeEach, describe, expect, it, vi} from 'vitest'

const {scope, calls} = vi.hoisted(() => ({
  scope: {current: undefined as string | undefined},
  calls: [] as string[],
}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
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

import {getMemberProfileByUserIdDao} from '@/db/repositories/member-profile-repository'
import {insertMemberRoleEventDao} from '@/db/repositories/member-role-event-repository'
import {
  countCapableMembersDao,
  deleteUserOrganizationDao,
  getUserOrganizationDao,
  lockOrganizationRolesDao,
} from '@/db/repositories/organization-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {removeUserFromOrganizationService} from '../organization-service'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '44444444-4444-4444-8444-444444444444'

const membership = (role: 'member' | 'board' | 'owner') => ({
  id: 'membership',
  organizationId: ORG_ID,
  userId: TARGET_ID,
  role,
  createdAt: new Date(),
})

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  setupAuthUserMocked({...userTestSuperAdmin, name: 'Zourite'})
  vi.mocked(lockOrganizationRolesDao).mockImplementation(async () => {
    calls.push(`lock:${scope.current}`)
  })
  vi.mocked(getUserOrganizationDao).mockImplementation(async () => {
    calls.push('membership')
    return membership('board')
  })
  vi.mocked(countCapableMembersDao).mockImplementation(async () => {
    calls.push('count')
    return 2
  })
  vi.mocked(deleteUserOrganizationDao).mockImplementation(async () => {
    calls.push('delete')
  })
  vi.mocked(insertMemberRoleEventDao).mockImplementation(async () => {
    calls.push(`trace:${scope.current}`)
  })
  vi.mocked(getUserByIdDao).mockResolvedValue({
    id: TARGET_ID,
    name: 'Paul Vidal',
  } as never)
  vi.mocked(getMemberProfileByUserIdDao).mockResolvedValue({
    id: 'profil-paul',
  } as never)
})

describe('removeUserFromOrganizationService — retrait soumis au dernier compte (s14, D2)', () => {
  it('[SUPER_ADMIN] retire un membre du Bureau sous verrou et trace removal', async () => {
    await removeUserFromOrganizationService(TARGET_ID, ORG_ID)

    expect(calls).toEqual([
      `lock:${ORG_ID}`,
      'membership',
      'count',
      'delete',
      `trace:${ORG_ID}`,
    ])
    expect(insertMemberRoleEventDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: 'profil-paul',
      targetUserId: TARGET_ID,
      targetName: 'Paul Vidal',
      authorUserId: userTestSuperAdmin.id,
      authorName: 'Zourite',
      fromRole: 'board',
      toRole: null,
      reason: 'removal',
    })
  })

  it('refuse de retirer le dernier compte capable, sans écriture (critère 3)', async () => {
    vi.mocked(countCapableMembersDao).mockResolvedValue(1)

    await expect(
      removeUserFromOrganizationService(TARGET_ID, ORG_ID)
    ).rejects.toThrow(ValidationError)
    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })

  it('retire un simple membre même quand un seul compte capable reste', async () => {
    vi.mocked(getUserOrganizationDao).mockResolvedValue(membership('member'))
    vi.mocked(countCapableMembersDao).mockResolvedValue(1)

    await removeUserFromOrganizationService(TARGET_ID, ORG_ID)

    expect(deleteUserOrganizationDao).toHaveBeenCalledWith(TARGET_ID, ORG_ID)
    expect(insertMemberRoleEventDao).toHaveBeenCalledWith(
      expect.objectContaining({fromRole: 'member', reason: 'removal'})
    )
  })

  it('garde le refus de retirer la Président(e)', async () => {
    vi.mocked(getUserOrganizationDao).mockResolvedValue(membership('owner'))

    await expect(
      removeUserFromOrganizationService(TARGET_ID, ORG_ID)
    ).rejects.toThrow(AuthorizationError)
    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
  })

  it('aucune ligne : rien à retirer, rien à tracer', async () => {
    vi.mocked(getUserOrganizationDao).mockResolvedValue(undefined)

    await removeUserFromOrganizationService(TARGET_ID, ORG_ID)

    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })

  it('[USER] refuse sans autorisation, sans verrou ni écriture', async () => {
    setupAuthUserMocked(userTest)

    await expect(
      removeUserFromOrganizationService(TARGET_ID, ORG_ID)
    ).rejects.toThrow(AuthorizationError)
    expect(lockOrganizationRolesDao).not.toHaveBeenCalled()
    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[GUEST] removeUserFromOrganizationService', () => {
  it('refuse un visiteur sans verrou ni écriture', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      removeUserFromOrganizationService(TARGET_ID, ORG_ID)
    ).rejects.toThrow(AuthorizationError)
    expect(lockOrganizationRolesDao).not.toHaveBeenCalled()
    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
  })
})
