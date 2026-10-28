import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

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
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
  createUserIfAbsentTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getUserOrganizationDao: vi.fn(),
  createMemberIfAbsentTxnDao: vi.fn(),
  deleteMemberWithRoleDao: vi.fn(),
  updateMemberRoleFromDao: vi.fn(),
  deleteUserOrganizationDao: vi.fn(),
  lockOrganizationRolesDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-role-event-repository', () => ({
  insertMemberRoleEventDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  setMemberProfileUserIdDao: vi.fn(),
  getUnlinkedMemberProfilesWithEmailDao: vi.fn(),
}))

import {
  getUnlinkedMemberProfilesWithEmailDao,
  setMemberProfileUserIdDao,
} from '@/db/repositories/member-profile-repository'
import {insertMemberRoleEventDao} from '@/db/repositories/member-role-event-repository'
import {
  createMemberIfAbsentTxnDao,
  deleteMemberWithRoleDao,
  deleteUserOrganizationDao,
  getUserOrganizationDao,
  lockOrganizationRolesDao,
  updateMemberRoleFromDao,
} from '@/db/repositories/organization-repository'
import {
  createUserIfAbsentTxnDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'

import {
  applyMemberAccountDecision,
  closeMemberAccount,
  getLinkedAccountRole,
  openMemberAccount,
  openMemberAccountsForOrganization,
  replaceMemberAccount,
} from '../member-account-service'
import {User} from '../types/domain/user-types'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const KNOWN_USER_ID = '55555555-5555-4555-8555-555555555555'
const NEW_USER_ID = '66666666-6666-4666-8666-666666666666'
const OLD_USER_ID = '77777777-7777-4777-8777-777777777777'

const AUTHOR = {
  userId: '88888888-8888-4888-8888-888888888888',
  name: 'Paul Vidal',
}

const knownUser: User = {
  ...userTest,
  id: KNOWN_USER_ID,
  email: 'odile@example.test',
  name: 'Nom déjà connu',
}

const memberRow = (role: 'member' | 'board' | 'owner', userId: string) => ({
  id: 'membership',
  organizationId: ORG_ID,
  userId,
  role,
  createdAt: new Date(),
})

/** Roles relus par `getUserOrganizationDao`, par compte. */
const givenRoles = (
  roles: Record<string, 'member' | 'board' | 'owner'>
): void => {
  vi.mocked(getUserOrganizationDao).mockImplementation(async (userId) =>
    roles[userId] ? (memberRow(roles[userId], userId) as never) : undefined
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
  vi.mocked(createUserIfAbsentTxnDao).mockResolvedValue({id: NEW_USER_ID})
  vi.mocked(createMemberIfAbsentTxnDao).mockImplementation(
    async (row) => memberRow(row.role ?? 'member', row.userId) as never
  )
  vi.mocked(getUserOrganizationDao).mockResolvedValue(undefined)
  vi.mocked(deleteMemberWithRoleDao).mockResolvedValue(1)
})

describe('openMemberAccount — trouver ou créer le compte d’une fiche', () => {
  it('réutilise un user déjà connu du produit, sans le renommer (critère 3)', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(knownUser)

    const result = await openMemberAccount({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'Odile@Example.test',
      name: 'Odile Marchand',
    })

    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(createMemberIfAbsentTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: KNOWN_USER_ID,
        role: 'member',
        createdAt: expect.any(Date),
      })
    )
    expect(setMemberProfileUserIdDao).toHaveBeenCalledWith(
      PROFILE_ID,
      KNOWN_USER_ID
    )
    expect(result).toEqual({userId: KNOWN_USER_ID})
  })

  it('crée le user en minuscules avec le nom de la fiche', async () => {
    await openMemberAccount({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: ' Odile.Marchand@Example.TEST ',
      name: 'Odile Marchand',
    })

    expect(getUserByEmailDao).toHaveBeenCalledWith(
      'odile.marchand@example.test'
    )
    expect(createUserIfAbsentTxnDao).toHaveBeenCalledWith({
      email: 'odile.marchand@example.test',
      name: 'Odile Marchand',
    })
    expect(setMemberProfileUserIdDao).toHaveBeenCalledWith(
      PROFILE_ID,
      NEW_USER_ID
    )
  })

  it('laisse intact un rôle existant dans l’association', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(knownUser)
    vi.mocked(createMemberIfAbsentTxnDao).mockResolvedValue(
      memberRow('board', KNOWN_USER_ID) as never
    )

    await openMemberAccount({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'odile@example.test',
      name: 'Odile Marchand',
    })

    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
    expect(deleteMemberWithRoleDao).not.toHaveBeenCalled()
  })

  it('écrit sous le scope du tenant', async () => {
    let linkedUnder: string | undefined
    vi.mocked(setMemberProfileUserIdDao).mockImplementation(async () => {
      linkedUnder = scope.current
    })

    await openMemberAccount({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'odile@example.test',
      name: 'Odile Marchand',
    })

    expect(linkedUnder).toBe(ORG_ID)
  })
})

describe('closeMemberAccount — fermer sans rien supprimer d’autre', () => {
  it('ne retire que la ligne member de rôle member, puis vide le lien', async () => {
    await closeMemberAccount({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      userId: KNOWN_USER_ID,
    })

    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      KNOWN_USER_ID,
      ORG_ID,
      'member'
    )
    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
    expect(setMemberProfileUserIdDao).toHaveBeenCalledWith(PROFILE_ID, null)
  })
})

describe('replaceMemberAccount — l’adresse change', () => {
  it('ferme l’ancien compte et ouvre le nouveau pour un propriétaire', async () => {
    givenRoles({[OLD_USER_ID]: 'member'})

    await replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'nouvelle@example.test',
      name: 'Odile Marchand',
    })

    expect(createMemberIfAbsentTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({userId: NEW_USER_ID, role: 'member'})
    )
    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      OLD_USER_ID,
      ORG_ID,
      'member'
    )
    expect(setMemberProfileUserIdDao).toHaveBeenLastCalledWith(
      PROFILE_ID,
      NEW_USER_ID
    )
  })

  it('déplace le rôle du bureau vers le nouveau compte', async () => {
    givenRoles({[OLD_USER_ID]: 'board'})

    await replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'helene.roux@example.test',
      name: 'Hélène Roux',
    })

    expect(createMemberIfAbsentTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({userId: NEW_USER_ID, role: 'board'})
    )
    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      OLD_USER_ID,
      ORG_ID,
      'board'
    )
    expect(setMemberProfileUserIdDao).toHaveBeenLastCalledWith(
      PROFILE_ID,
      NEW_USER_ID
    )
  })

  it('élève au rôle reporté un nouveau compte déjà simple membre', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(knownUser)
    vi.mocked(createMemberIfAbsentTxnDao).mockResolvedValue(
      memberRow('member', KNOWN_USER_ID) as never
    )
    givenRoles({[OLD_USER_ID]: 'owner', [KNOWN_USER_ID]: 'member'})

    await replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'odile@example.test',
      name: 'Odile Marchand',
    })

    expect(updateMemberRoleFromDao).toHaveBeenCalledWith(
      KNOWN_USER_ID,
      ORG_ID,
      'member',
      'owner'
    )
    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      OLD_USER_ID,
      ORG_ID,
      'owner'
    )
  })
})

describe('getLinkedAccountRole', () => {
  it('rend null pour une fiche sans compte', async () => {
    expect(await getLinkedAccountRole(ORG_ID, null)).toBeNull()
    expect(getUserOrganizationDao).not.toHaveBeenCalled()
  })

  it('rend le rôle du compte lié dans l’association', async () => {
    vi.mocked(getUserOrganizationDao).mockResolvedValue(
      memberRow('board', KNOWN_USER_ID) as never
    )

    expect(await getLinkedAccountRole(ORG_ID, KNOWN_USER_ID)).toBe('board')
  })

  it('rend null quand le compte lié n’a plus de ligne dans l’association', async () => {
    expect(await getLinkedAccountRole(ORG_ID, KNOWN_USER_ID)).toBeNull()
  })
})

describe('applyMemberAccountDecision — le changement d’accès', () => {
  const profile = {
    id: PROFILE_ID,
    name: 'Odile Marchand',
    email: 'odile@example.test',
    userId: OLD_USER_ID,
  }

  it.each([
    [{kind: 'none'} as const, null, OLD_USER_ID],
    [{kind: 'open'} as const, 'opened', NEW_USER_ID],
    [{kind: 'close'} as const, 'closed', null],
    [{kind: 'unlink'} as const, null, null],
    [{kind: 'replace'} as const, 'replaced', NEW_USER_ID],
  ])('%o → %s', async (decision, change, userId) => {
    expect(
      await applyMemberAccountDecision({
        organizationId: ORG_ID,
        author: AUTHOR,
        profile,
        decision,
      })
    ).toEqual({change, userId})
  })

  it('n’écrit aucun compte pour une décision none', async () => {
    await applyMemberAccountDecision({
      organizationId: ORG_ID,
      author: AUTHOR,
      profile,
      decision: {kind: 'none'},
    })

    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(createMemberIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(deleteMemberWithRoleDao).not.toHaveBeenCalled()
    expect(setMemberProfileUserIdDao).not.toHaveBeenCalled()
  })
})

describe('applyMemberAccountDecision — délier sans fermer', () => {
  it('vide le lien d’une fiche liée sans retirer aucune ligne member, sous le scope', async () => {
    let unlinkedUnder: string | undefined
    vi.mocked(setMemberProfileUserIdDao).mockImplementation(async () => {
      unlinkedUnder = scope.current
    })

    await applyMemberAccountDecision({
      organizationId: ORG_ID,
      author: AUTHOR,
      profile: {
        id: PROFILE_ID,
        name: 'Odile Marchand',
        email: null,
        userId: OLD_USER_ID,
      },
      decision: {kind: 'unlink'},
    })

    expect(setMemberProfileUserIdDao).toHaveBeenCalledWith(PROFILE_ID, null)
    expect(unlinkedUnder).toBe(ORG_ID)
    expect(deleteMemberWithRoleDao).not.toHaveBeenCalled()
    expect(deleteUserOrganizationDao).not.toHaveBeenCalled()
  })

  it('n’écrit rien pour une fiche déjà sans lien', async () => {
    expect(
      await applyMemberAccountDecision({
        organizationId: ORG_ID,
        author: AUTHOR,
        profile: {
          id: PROFILE_ID,
          name: 'Paul Ferrand',
          email: null,
          userId: null,
        },
        decision: {kind: 'unlink'},
      })
    ).toEqual({change: null, userId: null})

    expect(setMemberProfileUserIdDao).not.toHaveBeenCalled()
  })
})

describe('openMemberAccountsForOrganization — reprise en lot (critère 2)', () => {
  it('ouvre le compte de chaque fiche à adresse encore sans compte', async () => {
    vi.mocked(getUnlinkedMemberProfilesWithEmailDao).mockResolvedValue([
      {id: 'p1', name: 'Bernard Lefèvre', email: 'bernard@example.test'},
      {id: 'p2', name: 'Lucie Moreau', email: 'Lucie@Example.test'},
    ])

    const result = await openMemberAccountsForOrganization(ORG_ID)

    expect(getUnlinkedMemberProfilesWithEmailDao).toHaveBeenCalledWith(ORG_ID)
    expect(setMemberProfileUserIdDao).toHaveBeenCalledTimes(2)
    expect(createUserIfAbsentTxnDao).toHaveBeenCalledWith({
      email: 'lucie@example.test',
      name: 'Lucie Moreau',
    })
    expect(result).toEqual({opened: 2})
  })

  it('ne crée rien de plus quand on le relance', async () => {
    vi.mocked(getUnlinkedMemberProfilesWithEmailDao).mockResolvedValue([])

    expect(await openMemberAccountsForOrganization(ORG_ID)).toEqual({
      opened: 0,
    })
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(createMemberIfAbsentTxnDao).not.toHaveBeenCalled()
  })
})

/**
 * D5, ADR 039 : le deplacement d'un role du bureau par changement d'adresse
 * est trace (`email_change`), auteur = le membre du bureau qui a change
 * l'adresse. Une ligne par compte dont le role change.
 */
describe('replaceMemberAccount — trace du déplacement de rôle (s14, D5)', () => {
  const replaceBoard = (
    role: 'member' | 'board' | 'owner',
    others: Record<string, 'member' | 'board' | 'owner'> = {}
  ) => {
    givenRoles({[OLD_USER_ID]: role, ...others})
    return replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'helene.roux@example.test',
      name: 'Hélène Roux',
    })
  }

  it('trace l’arrivée du rôle sur le nouveau compte et son départ de l’ancien', async () => {
    let tracedUnder: string | undefined
    vi.mocked(insertMemberRoleEventDao).mockImplementation(async () => {
      tracedUnder = scope.current
    })

    await replaceBoard('board')

    expect(insertMemberRoleEventDao).toHaveBeenCalledTimes(2)
    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(1, {
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      targetUserId: NEW_USER_ID,
      targetName: 'Hélène Roux',
      authorUserId: AUTHOR.userId,
      authorName: AUTHOR.name,
      fromRole: null,
      toRole: 'board',
      reason: 'email_change',
    })
    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(2, {
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      targetUserId: OLD_USER_ID,
      targetName: 'Hélène Roux',
      authorUserId: AUTHOR.userId,
      authorName: AUTHOR.name,
      fromRole: 'board',
      toRole: null,
      reason: 'email_change',
    })
    expect(tracedUnder).toBe(ORG_ID)
  })

  it('trace la promotion d’un compte déjà simple membre', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(knownUser)
    vi.mocked(createMemberIfAbsentTxnDao).mockResolvedValue(
      memberRow('member', KNOWN_USER_ID) as never
    )

    await replaceBoard('owner', {[KNOWN_USER_ID]: 'member'})

    expect(insertMemberRoleEventDao).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        targetUserId: KNOWN_USER_ID,
        fromRole: 'member',
        toRole: 'owner',
      })
    )
  })

  it('ne trace rien pour un simple membre', async () => {
    await replaceBoard('member')

    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })

  it('ne trace rien quand l’adresse retombe sur le même compte, déjà au rôle', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({
      ...knownUser,
      id: OLD_USER_ID,
    })
    vi.mocked(createMemberIfAbsentTxnDao).mockResolvedValue(
      memberRow('board', OLD_USER_ID) as never
    )

    await replaceBoard('board')

    expect(deleteMemberWithRoleDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })
})

/**
 * Revue 1 de s14 : le deplacement d'un role par changement d'adresse prend le
 * verrou des roles de l'association avant toute lecture de role, comme
 * `changeMemberRoleService`, et ne trace le depart de l'ancien compte que si
 * sa ligne a bien ete retiree.
 */
describe('replaceMemberAccount — verrou et retrait effectif (s14, revue 1)', () => {
  const replace = (role: 'member' | 'board' | 'owner') => {
    givenRoles({[OLD_USER_ID]: role})
    return replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'helene.roux@example.test',
      name: 'Hélène Roux',
    })
  }

  it('prend le verrou des rôles sous le scope, puis relit le rôle de l’ancien compte, avant toute écriture', async () => {
    const calls: string[] = []
    vi.mocked(lockOrganizationRolesDao).mockImplementation(async (orgId) => {
      calls.push(`lock:${orgId}:${scope.current}`)
    })
    vi.mocked(createMemberIfAbsentTxnDao).mockImplementation(async (row) => {
      calls.push('membership')
      return memberRow(row.role ?? 'member', row.userId) as never
    })
    vi.mocked(deleteMemberWithRoleDao).mockImplementation(async () => {
      calls.push('delete')
      return 1
    })

    vi.mocked(getUserOrganizationDao).mockImplementation(async (userId) => {
      calls.push(`read-role:${userId}`)
      return userId === OLD_USER_ID
        ? (memberRow('board', OLD_USER_ID) as never)
        : undefined
    })

    await replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'helene.roux@example.test',
      name: 'Hélène Roux',
    })

    expect(calls).toEqual([
      `lock:${ORG_ID}:${ORG_ID}`,
      `read-role:${OLD_USER_ID}`,
      `read-role:${NEW_USER_ID}`,
      'membership',
      'delete',
    ])
  })

  it('ne trace pas le départ de l’ancien compte quand aucune ligne n’a été retirée', async () => {
    vi.mocked(deleteMemberWithRoleDao).mockResolvedValue(0)

    await replace('board')

    expect(insertMemberRoleEventDao).toHaveBeenCalledTimes(1)
    expect(insertMemberRoleEventDao).toHaveBeenCalledWith(
      expect.objectContaining({targetUserId: NEW_USER_ID, toRole: 'board'})
    )
    expect(insertMemberRoleEventDao).not.toHaveBeenCalledWith(
      expect.objectContaining({targetUserId: OLD_USER_ID})
    )
  })
})

/**
 * Revue 2 de s14 : le role deplace est relu sous le verrou, sur l'ancien
 * compte, et non recu de l'appelant qui l'a lu avant le verrou. Une
 * retrogradation concurrente n'est pas annulee par le changement d'adresse.
 */
describe('replaceMemberAccount — rôle relu sous le verrou (s14, revue 2)', () => {
  const replace = () =>
    replaceMemberAccount({
      organizationId: ORG_ID,
      author: AUTHOR,
      memberProfileId: PROFILE_ID,
      previousUserId: OLD_USER_ID,
      email: 'helene.roux@example.test',
      name: 'Hélène Roux',
    })

  it('déplace le rôle relu après le verrou, pas un rôle lu avant', async () => {
    givenRoles({[OLD_USER_ID]: 'member'})

    await replace()

    expect(createMemberIfAbsentTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({userId: NEW_USER_ID, role: 'member'})
    )
    expect(updateMemberRoleFromDao).not.toHaveBeenCalled()
    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      OLD_USER_ID,
      ORG_ID,
      'member'
    )
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
  })

  it('ancien compte sans ligne ici : ouvre en simple membre, ne retire ni ne trace rien', async () => {
    givenRoles({})

    const result = await replace()

    expect(createMemberIfAbsentTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({userId: NEW_USER_ID, role: 'member'})
    )
    expect(deleteMemberWithRoleDao).not.toHaveBeenCalled()
    expect(insertMemberRoleEventDao).not.toHaveBeenCalled()
    expect(setMemberProfileUserIdDao).toHaveBeenLastCalledWith(
      PROFILE_ID,
      NEW_USER_ID
    )
    expect(result).toEqual({userId: NEW_USER_ID})
  })
})
