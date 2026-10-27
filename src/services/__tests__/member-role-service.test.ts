import {beforeEach, describe, expect, it, vi} from 'vitest'

const {scope, calls} = vi.hoisted(() => ({
  scope: {current: undefined as string | undefined},
  calls: [] as string[],
}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    calls.push(`withTenant:${organizationId}`)
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  countCapableMembersDao: vi.fn(),
  getOrganizationByDomainDao: vi.fn(),
  getOrganizationOwnerDao: vi.fn(),
  getUserRoleInOrganizationDao: vi.fn(),
  lockOrganizationRolesDao: vi.fn(),
  updateMemberRoleFromDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfileByIdDao: vi.fn(),
  getMemberProfileByUserIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-role-event-repository', () => ({
  insertMemberRoleEventDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
  getUserByIdDao: vi.fn(),
}))

import {getMemberProfileByIdDao} from '@/db/repositories/member-profile-repository'
import {getMemberProfileByUserIdDao} from '@/db/repositories/member-profile-repository'
import {insertMemberRoleEventDao} from '@/db/repositories/member-role-event-repository'
import {
  countCapableMembersDao,
  getOrganizationByDomainDao,
  getOrganizationOwnerDao,
  getUserRoleInOrganizationDao,
  lockOrganizationRolesDao,
  updateMemberRoleFromDao,
} from '@/db/repositories/organization-repository'
import {getUserByEmailDao} from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  changeMemberRoleService,
  transferPresidencyByOperatorService,
} from '../member-role-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const TARGET_USER_ID = '44444444-4444-4444-8444-444444444444'
const VIEWER_ID = userTest.id

const withMembership = (role: OrganizationRole, orgId = ORG_ID): User => ({
  ...userTest,
  name: 'Hélène Roux',
  organizations: [
    {
      id: `${orgId}-${role}`,
      organizationId: orgId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Paul Vidal',
  email: 'paul@example.test',
  phone: null,
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
  userId: TARGET_USER_ID,
  mailOnly: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/** Rôles en base, relus sous verrou : `viewer` et `target`. */
const rolesInDb = (roles: {
  viewer: OrganizationRole | null
  target: OrganizationRole | null
}) => {
  vi.mocked(getUserRoleInOrganizationDao).mockImplementation(async (userId) => {
    calls.push(`role:${userId === VIEWER_ID ? 'viewer' : 'target'}`)
    return userId === VIEWER_ID ? roles.viewer : roles.target
  })
}

const change = (role: string, memberProfileId = PROFILE_ID) =>
  changeMemberRoleService({organizationId: ORG_ID, memberProfileId, role})

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  scope.current = undefined
  vi.mocked(getMemberProfileByIdDao).mockImplementation(async () => {
    calls.push('profile')
    return profileRow() as never
  })
  vi.mocked(lockOrganizationRolesDao).mockImplementation(async () => {
    calls.push(`lock:${scope.current}`)
  })
  vi.mocked(countCapableMembersDao).mockImplementation(async () => {
    calls.push('count')
    return 2
  })
  vi.mocked(updateMemberRoleFromDao).mockImplementation(
    async (userId, _orgId, from, to) => {
      calls.push(`update:${userId}:${from}->${to}`)
      return 1
    }
  )
  vi.mocked(insertMemberRoleEventDao).mockImplementation(async () => {
    calls.push(`trace:${scope.current}`)
  })
})

describe('[GUEST] changeMemberRoleService', () => {
  it('refuse sans rien lire ni écrire', async () => {
    setupAuthUserMocked()

    await expect(change('board')).rejects.toThrow(AuthorizationError)
    expect(getMemberProfileByIdDao).not.toHaveBeenCalled()
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })
})

describe('[USER] changeMemberRoleService', () => {
  it('[ORGANIZATION MEMBER] refuse un membre simple', async () => {
    setupAuthUserMocked(withMembership(UserOrganizationRoleConst.MEMBER))

    await expect(change('board')).rejects.toThrow(AuthorizationError)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('[USER NOT IN ORGANIZATION] refuse la présidence d’une autre association (critère 5)', async () => {
    setupAuthUserMocked(
      withMembership(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
    )

    await expect(change('board')).rejects.toThrow(AuthorizationError)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('refuse des identifiants mal formés', async () => {
    setupAuthUserMocked(withMembership(UserOrganizationRoleConst.ADMIN))

    await expect(
      changeMemberRoleService({
        organizationId: 'pas-un-uuid',
        memberProfileId: PROFILE_ID,
        role: 'board',
      })
    ).rejects.toThrow(ValidationParsedZodError)
  })
})

describe('[ORGANIZATION BOARD] changeMemberRoleService', () => {
  beforeEach(() => {
    setupAuthUserMocked(withMembership(UserOrganizationRoleConst.ADMIN))
  })

  it('promeut un Membre au Bureau : verrou, décompte, écriture conditionnelle, trace', async () => {
    rolesInDb({viewer: 'board', target: 'member'})

    const result = await change('board')

    expect(result).toEqual({
      status: 'saved',
      change: 'assigned',
      self: false,
      name: 'Paul Vidal',
    })
    expect(updateMemberRoleFromDao).toHaveBeenCalledWith(
      TARGET_USER_ID,
      ORG_ID,
      'member',
      'board'
    )
    expect(insertMemberRoleEventDao).toHaveBeenCalledTimes(1)
    expect(insertMemberRoleEventDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      targetUserId: TARGET_USER_ID,
      targetName: 'Paul Vidal',
      authorUserId: VIEWER_ID,
      authorName: 'Hélène Roux',
      fromRole: 'member',
      toRole: 'board',
      reason: 'assignment',
    })
  })

  it('épingle l’ordre : fiche, verrou, rôles, décompte, écriture, trace — tout sous withTenant', async () => {
    rolesInDb({viewer: 'board', target: 'member'})

    await change('board')

    expect(calls).toEqual([
      `withTenant:${ORG_ID}`,
      'profile',
      `lock:${ORG_ID}`,
      'role:target',
      'role:viewer',
      'count',
      `update:${TARGET_USER_ID}:member->board`,
      `trace:${ORG_ID}`,
    ])
  })

  it('prend le user_id de la fiche relue, jamais de l’entrée', async () => {
    rolesInDb({viewer: 'board', target: 'member'})

    await changeMemberRoleService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      role: 'board',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    } as never)

    expect(updateMemberRoleFromDao).toHaveBeenCalledWith(
      TARGET_USER_ID,
      ORG_ID,
      'member',
      'board'
    )
  })

  it('rétrograde un membre du Bureau (trace vers member)', async () => {
    rolesInDb({viewer: 'board', target: 'board'})

    const result = await change('member')

    expect(result).toMatchObject({status: 'saved', change: 'demoted'})
    expect(insertMemberRoleEventDao).toHaveBeenCalledWith(
      expect.objectContaining({
        fromRole: 'board',
        toRole: 'member',
        reason: 'assignment',
      })
    )
  })

  it('se rétrograde lui-même : self vaut vrai', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(
      profileRow({userId: VIEWER_ID, name: 'Hélène Roux'}) as never
    )
    vi.mocked(getUserRoleInOrganizationDao).mockResolvedValue('board')

    const result = await change('member')

    expect(result).toEqual({
      status: 'saved',
      change: 'demoted',
      self: true,
      name: 'Hélène Roux',
    })
  })

  it('n’écrit rien quand le choix égale le rôle enregistré', async () => {
    rolesInDb({viewer: 'board', target: 'board'})

    expect(await change('board')).toMatchObject({
      status: 'saved',
      change: 'none',
    })
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })

  it.each([
    ['owner', 'member'],
    ['board', 'owner'],
  ] as const)(
    'refuse la présidence au Bureau (cible %s, vers %s)',
    async (target, nextRole) => {
      rolesInDb({viewer: 'board', target})

      expect(await change(nextRole)).toEqual({
        status: 'refused',
        reason: 'presidency_reserved',
        self: false,
        name: 'Paul Vidal',
      })
      expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
      expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
    }
  )

  it('refuse le dernier compte capable, sans écriture (critère 3)', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(
      profileRow({userId: VIEWER_ID, name: 'Hélène Roux'}) as never
    )
    vi.mocked(getUserRoleInOrganizationDao).mockResolvedValue('board')
    vi.mocked(countCapableMembersDao).mockResolvedValue(1)

    expect(await change('member')).toEqual({
      status: 'refused',
      reason: 'last_capable',
      self: true,
      name: 'Hélène Roux',
    })
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })

  it.each(['super_admin', 'admin', ''])(
    'refuse le rôle « %s » sans écriture (critère 6)',
    async (role) => {
      rolesInDb({viewer: 'board', target: 'member'})

      expect(await change(role)).toMatchObject({
        status: 'refused',
        reason: 'invalid_role',
      })
      expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
    }
  )

  it('fiche introuvable sous le tenant (autre association) : not_found, aucune écriture (critère 5)', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    expect(await change('board')).toEqual({status: 'not_found'})
    expect(lockOrganizationRolesDao).not.toHaveBeenCalled()
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('fiche courrier uniquement : no_account, aucune écriture', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(
      profileRow({userId: null, email: null, mailOnly: true}) as never
    )

    expect(await change('board')).toEqual({status: 'no_account'})
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('compte lié sans ligne member ici : no_account', async () => {
    rolesInDb({viewer: 'board', target: null})

    expect(await change('board')).toEqual({status: 'no_account'})
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('échoue si le rôle a changé malgré le verrou (aucune trace)', async () => {
    rolesInDb({viewer: 'board', target: 'member'})
    vi.mocked(updateMemberRoleFromDao).mockResolvedValue(0)

    await expect(change('board')).rejects.toThrow()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION OWNER] changeMemberRoleService — passation', () => {
  beforeEach(() => {
    setupAuthUserMocked(withMembership(UserOrganizationRoleConst.OWNER))
  })

  it('transmet la présidence : cible owner puis appelante board, deux traces', async () => {
    rolesInDb({viewer: 'owner', target: 'board'})
    vi.mocked(getMemberProfileByUserIdDao).mockResolvedValue(
      profileRow({id: 'profil-presidente', userId: VIEWER_ID}) as never
    )

    const result = await change('owner')

    expect(result).toEqual({
      status: 'saved',
      change: 'presidency_transferred',
      self: false,
      name: 'Paul Vidal',
    })
    expect(
      calls.filter((c) => c.startsWith('update') || c.startsWith('trace'))
    ).toEqual([
      `update:${TARGET_USER_ID}:board->owner`,
      `update:${VIEWER_ID}:owner->board`,
      `trace:${ORG_ID}`,
      `trace:${ORG_ID}`,
    ])
    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(1, {
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      targetUserId: TARGET_USER_ID,
      targetName: 'Paul Vidal',
      authorUserId: VIEWER_ID,
      authorName: 'Hélène Roux',
      fromRole: 'board',
      toRole: 'owner',
      reason: 'presidency_transfer',
    })
    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(2, {
      organizationId: ORG_ID,
      memberProfileId: 'profil-presidente',
      targetUserId: VIEWER_ID,
      targetName: 'Hélène Roux',
      authorUserId: VIEWER_ID,
      authorName: 'Hélène Roux',
      fromRole: 'owner',
      toRole: 'board',
      reason: 'presidency_transfer',
    })
  })

  it('refuse de modifier son propre rôle', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(
      profileRow({userId: VIEWER_ID}) as never
    )
    vi.mocked(getUserRoleInOrganizationDao).mockResolvedValue('owner')

    expect(await change('board')).toMatchObject({
      status: 'refused',
      reason: 'own_presidency',
    })
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })
})

describe('[SUPER_ADMIN] changeMemberRoleService', () => {
  beforeEach(() => {
    setupAuthUserMocked({...userTestSuperAdmin, name: 'Zourite'})
  })

  it('promeut au Bureau comme un membre du Bureau', async () => {
    vi.mocked(getUserRoleInOrganizationDao).mockImplementation(
      async (userId) => (userId === TARGET_USER_ID ? 'member' : null)
    )

    expect(await change('board')).toMatchObject({
      status: 'saved',
      change: 'assigned',
    })
  })

  it('ne transmet pas la présidence, même avec une ligne owner (D4)', async () => {
    vi.mocked(getUserRoleInOrganizationDao).mockImplementation(
      async (userId) => (userId === TARGET_USER_ID ? 'board' : 'owner')
    )

    expect(await change('owner')).toMatchObject({
      status: 'refused',
      reason: 'presidency_reserved',
    })
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })
})

describe('transferPresidencyByOperatorService — recours d’exploitation (D8)', () => {
  const organization = {id: ORG_ID, domain: 'clos-fleuri.test'}
  const successor = {
    ...userTest,
    id: TARGET_USER_ID,
    name: 'Paul Vidal',
    email: 'paul@example.test',
  }

  beforeEach(() => {
    vi.mocked(getOrganizationByDomainDao).mockResolvedValue(
      organization as never
    )
    vi.mocked(getUserByEmailDao).mockResolvedValue(successor as never)
    vi.mocked(getUserRoleInOrganizationDao).mockResolvedValue('board')
    vi.mocked(getOrganizationOwnerDao).mockResolvedValue({
      userId: VIEWER_ID,
      name: 'Hélène Roux',
    })
    vi.mocked(getMemberProfileByUserIdDao).mockResolvedValue(undefined)
  })

  it('refuse un domaine inconnu', async () => {
    vi.mocked(getOrganizationByDomainDao).mockResolvedValue(undefined)

    await expect(
      transferPresidencyByOperatorService('inconnu.test', 'paul@example.test')
    ).rejects.toThrow(/domaine/)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('refuse une adresse sans compte', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)

    await expect(
      transferPresidencyByOperatorService('clos-fleuri.test', 'x@example.test')
    ).rejects.toThrow(/compte membre/)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('refuse un compte qui n’est pas membre de cette association', async () => {
    vi.mocked(getUserRoleInOrganizationDao).mockResolvedValue(null)

    await expect(
      transferPresidencyByOperatorService(
        'clos-fleuri.test',
        'paul@example.test'
      )
    ).rejects.toThrow(/compte membre/)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('refuse un compte SuperAdmin (D3)', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({
      ...successor,
      role: 'super_admin',
    } as never)

    await expect(
      transferPresidencyByOperatorService(
        'clos-fleuri.test',
        'paul@example.test'
      )
    ).rejects.toThrow(/SuperAdmin/)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
  })

  it('passe la présidence sous verrou, l’ancienne redevient Bureau, deux traces « Zourite Studio »', async () => {
    const result = await transferPresidencyByOperatorService(
      ' Clos-Fleuri.test ',
      'Paul@Example.test'
    )

    expect(getOrganizationByDomainDao).toHaveBeenCalledWith('clos-fleuri.test')
    expect(getUserByEmailDao).toHaveBeenCalledWith('paul@example.test')
    expect(result).toEqual({
      organizationId: ORG_ID,
      newOwnerUserId: TARGET_USER_ID,
      previousOwnerUserId: VIEWER_ID,
      changed: true,
    })
    expect(calls).toEqual([
      `withTenant:${ORG_ID}`,
      `lock:${ORG_ID}`,
      `update:${TARGET_USER_ID}:board->owner`,
      `update:${VIEWER_ID}:owner->board`,
      `trace:${ORG_ID}`,
      `trace:${ORG_ID}`,
    ])
    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        targetUserId: TARGET_USER_ID,
        targetName: 'Paul Vidal',
        authorUserId: null,
        authorName: 'Zourite Studio',
        fromRole: 'board',
        toRole: 'owner',
        reason: 'presidency_transfer',
      })
    )
    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        targetUserId: VIEWER_ID,
        targetName: 'Hélène Roux',
        authorUserId: null,
        authorName: 'Zourite Studio',
        fromRole: 'owner',
        toRole: 'board',
        reason: 'presidency_transfer',
      })
    )
  })

  it('association sans Président(e) : une seule écriture, une seule trace', async () => {
    vi.mocked(getOrganizationOwnerDao).mockResolvedValue(undefined)

    const result = await transferPresidencyByOperatorService(
      'clos-fleuri.test',
      'paul@example.test'
    )

    expect(result.previousOwnerUserId).toBeNull()
    expect(updateMemberRoleFromDao).toHaveBeenCalledTimes(1)
    expect(insertMemberRoleEventDao).toHaveBeenCalledTimes(1)
  })

  it('le successeur est déjà Président(e) : rien n’est écrit', async () => {
    vi.mocked(getUserRoleInOrganizationDao).mockResolvedValue('owner')
    vi.mocked(getOrganizationOwnerDao).mockResolvedValue({
      userId: TARGET_USER_ID,
      name: 'Paul Vidal',
    })

    const result = await transferPresidencyByOperatorService(
      'clos-fleuri.test',
      'paul@example.test'
    )

    expect(result.changed).toBe(false)
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })
})
