import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/recipient-group-repository', () => ({
  listRecipientGroupsDao: vi.fn(),
  getRecipientGroupByIdDao: vi.fn(),
  createRecipientGroupTxnDao: vi.fn(),
  renameRecipientGroupTxnDao: vi.fn(),
  deleteRecipientGroupTxnDao: vi.fn(),
  addRecipientGroupMembersTxnDao: vi.fn(),
  removeRecipientGroupMembersTxnDao: vi.fn(),
  getRecipientGroupMemberIdsDao: vi.fn(),
  getReadableMemberProfileIdsDao: vi.fn(),
}))
vi.mock('@/db/repositories/campaign-repository', () => ({
  getCampaignTargetRowsDao: vi.fn(),
}))

import {getCampaignTargetRowsDao} from '@/db/repositories/campaign-repository'
import {
  addRecipientGroupMembersTxnDao,
  createRecipientGroupTxnDao,
  deleteRecipientGroupTxnDao,
  getReadableMemberProfileIdsDao,
  getRecipientGroupByIdDao,
  getRecipientGroupMemberIdsDao,
  listRecipientGroupsDao,
  removeRecipientGroupMembersTxnDao,
  renameRecipientGroupTxnDao,
} from '@/db/repositories/recipient-group-repository'
import {withTenant} from '@/db/tenant-scope'

import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {DuplicateRecipientGroupNameError} from '../errors/recipient-group-errors'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  addMembersToRecipientGroupService,
  canManageRecipientGroupsService,
  createRecipientGroupService,
  deleteRecipientGroupService,
  getRecipientGroupService,
  listRecipientGroupsService,
  removeMembersFromRecipientGroupService,
  renameRecipientGroupService,
} from '../recipient-group-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {RECIPIENT_GROUP_NAME_MAX_LENGTH} from '../types/domain/recipient-group-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const GROUP_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = '44444444-4444-4444-8444-444444444444'
const PROFILE_B = '55555555-5555-4555-8555-555555555555'
const FOREIGN_PROFILE = '66666666-6666-4666-8666-666666666666'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const board = withRole(UserOrganizationRoleConst.ADMIN)
const plainMember = withRole(UserOrganizationRoleConst.MEMBER)

const groupRow = (overrides: Record<string, unknown> = {}) => ({
  id: GROUP_ID,
  name: 'Riverains',
  profileCount: 2,
  ...overrides,
})

const targetRow = (
  memberProfileId: string,
  email: string | null,
  unsubscribed = false
) => ({
  memberProfileId,
  name: memberProfileId,
  email,
  unsubscribed,
  currentParcelNumbers: [],
  accountName: null,
})

const scopeInput = {organizationId: ORG_ID, groupId: GROUP_ID}

const calls: [string, () => Promise<unknown>][] = [
  ['lister les groupes', () => listRecipientGroupsService(ORG_ID)],
  ['ouvrir un groupe', () => getRecipientGroupService(scopeInput)],
  [
    'créer un groupe',
    () => createRecipientGroupService({organizationId: ORG_ID, name: 'R'}),
  ],
  [
    'renommer un groupe',
    () => renameRecipientGroupService({...scopeInput, name: 'R'}),
  ],
  ['supprimer un groupe', () => deleteRecipientGroupService(scopeInput)],
  [
    'ajouter des fiches',
    () =>
      addMembersToRecipientGroupService({
        ...scopeInput,
        memberProfileIds: [PROFILE_A],
      }),
  ],
  [
    'retirer des fiches',
    () =>
      removeMembersFromRecipientGroupService({
        ...scopeInput,
        memberProfileIds: [PROFILE_A],
      }),
  ],
]

const expectNoDaoCall = () => {
  for (const dao of [
    listRecipientGroupsDao,
    getRecipientGroupByIdDao,
    createRecipientGroupTxnDao,
    renameRecipientGroupTxnDao,
    deleteRecipientGroupTxnDao,
    addRecipientGroupMembersTxnDao,
    removeRecipientGroupMembersTxnDao,
    getReadableMemberProfileIdsDao,
  ]) {
    expect(dao).not.toHaveBeenCalled()
  }
  expect(withTenant).not.toHaveBeenCalled()
}

beforeEach(async () => {
  vi.clearAllMocks()
  await setupAuthUserMocked(board)
  vi.mocked(listRecipientGroupsDao).mockResolvedValue([groupRow()])
  vi.mocked(getRecipientGroupByIdDao).mockResolvedValue(groupRow())
  vi.mocked(createRecipientGroupTxnDao).mockResolvedValue({
    status: 'created',
    row: groupRow({profileCount: 0}),
  })
  vi.mocked(renameRecipientGroupTxnDao).mockResolvedValue({
    status: 'updated',
    row: groupRow({name: 'Bord de mer'}),
  })
  vi.mocked(deleteRecipientGroupTxnDao).mockResolvedValue({id: GROUP_ID})
  vi.mocked(addRecipientGroupMembersTxnDao).mockResolvedValue(1)
  vi.mocked(removeRecipientGroupMembersTxnDao).mockResolvedValue(1)
  vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([
    PROFILE_A,
    PROFILE_B,
  ])
  vi.mocked(getReadableMemberProfileIdsDao).mockImplementation(
    async (ids: string[]) => ids.filter((id) => id !== FOREIGN_PROFILE)
  )
  vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([])
})

describe('aucun accès hors du bureau de l’association (campaign.group.manage)', () => {
  describe.each(calls)('%s', (_label, call) => {
    it('[GUEST] refuse un visiteur sans session, sans appel au DAO', async () => {
      await setupAuthUserMocked(undefined)

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[ORGANIZATION MEMBER] refuse un membre simple, sans appel au DAO', async () => {
      await setupAuthUserMocked(plainMember)

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[USER NOT IN ORGANIZATION] refuse le bureau d’une autre association', async () => {
      await setupAuthUserMocked(
        withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
      )

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[SUPER_ADMIN] autorise le SuperAdmin', async () => {
      await setupAuthUserMocked(userTestSuperAdmin)

      await expect(call()).resolves.not.toThrow()
    })

    it('[ORGANIZATION BOARD] autorise le bureau, sous le scope du tenant', async () => {
      await expect(call()).resolves.not.toThrow()
      expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    })
  })

  it('canManageRecipientGroupsService rend le droit sans lever', async () => {
    expect(await canManageRecipientGroupsService(ORG_ID)).toBe(true)
    await setupAuthUserMocked(plainMember)
    expect(await canManageRecipientGroupsService(ORG_ID)).toBe(false)
    expect(await canManageRecipientGroupsService('pas-un-uuid')).toBe(false)
  })
})

describe('nom d’un groupe — obligatoire, bords retirés, unique sans casse', () => {
  it('écrit le nom sans ses bords', async () => {
    await createRecipientGroupService({
      organizationId: ORG_ID,
      name: '  Riverains  ',
    })

    expect(createRecipientGroupTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      name: 'Riverains',
    })
  })

  it.each([
    ['vide', '   '],
    ['trop long', 'x'.repeat(RECIPIENT_GROUP_NAME_MAX_LENGTH + 1)],
  ])('refuse un nom %s, sans rien écrire', async (_label, name) => {
    await expect(
      createRecipientGroupService({organizationId: ORG_ID, name})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expect(createRecipientGroupTxnDao).not.toHaveBeenCalled()
  })

  it('un nom déjà pris, quelle qu’en soit la casse, est un refus typé', async () => {
    vi.mocked(createRecipientGroupTxnDao).mockResolvedValue({
      status: 'duplicate_name',
    })

    await expect(
      createRecipientGroupService({organizationId: ORG_ID, name: 'RIVERAINS'})
    ).rejects.toBeInstanceOf(DuplicateRecipientGroupNameError)
  })

  it('renommer vers un nom pris est le même refus', async () => {
    vi.mocked(renameRecipientGroupTxnDao).mockResolvedValue({
      status: 'duplicate_name',
    })

    await expect(
      renameRecipientGroupService({...scopeInput, name: 'riverains'})
    ).rejects.toBeInstanceOf(DuplicateRecipientGroupNameError)
  })

  it('renommer un groupe introuvable est introuvable', async () => {
    vi.mocked(renameRecipientGroupTxnDao).mockResolvedValue({
      status: 'not_found',
    })

    await expect(
      renameRecipientGroupService({...scopeInput, name: 'Bord de mer'})
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('composition — ajout depuis la liste des membres (critère 3)', () => {
  it('ajoute les fiches et rend le groupe tel qu’il est après', async () => {
    const result = await addMembersToRecipientGroupService({
      ...scopeInput,
      memberProfileIds: [PROFILE_A, PROFILE_B],
    })

    expect(addRecipientGroupMembersTxnDao).toHaveBeenCalledWith(
      ORG_ID,
      GROUP_ID,
      [PROFILE_A, PROFILE_B]
    )
    expect(result).toEqual({changed: 1, group: groupRow()})
  })

  it('refuse une fiche illisible sous le tenant, sans rien écrire (critère 8)', async () => {
    await expect(
      addMembersToRecipientGroupService({
        ...scopeInput,
        memberProfileIds: [PROFILE_A, FOREIGN_PROFILE],
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(addRecipientGroupMembersTxnDao).not.toHaveBeenCalled()
  })

  it('refuse un groupe introuvable, sans rien écrire', async () => {
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue(undefined)

    await expect(
      addMembersToRecipientGroupService({
        ...scopeInput,
        memberProfileIds: [PROFILE_A],
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(addRecipientGroupMembersTxnDao).not.toHaveBeenCalled()
  })

  it('refuse une sélection vide', async () => {
    await expect(
      addMembersToRecipientGroupService({...scopeInput, memberProfileIds: []})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
  })

  it('retire les fiches du groupe', async () => {
    const result = await removeMembersFromRecipientGroupService({
      ...scopeInput,
      memberProfileIds: [PROFILE_A],
    })

    expect(removeRecipientGroupMembersTxnDao).toHaveBeenCalledWith(GROUP_ID, [
      PROFILE_A,
    ])
    expect(result.changed).toBe(1)
  })
})

describe('suppression — ni les fiches ni les campagnes ne bougent (critère 6)', () => {
  it('supprime le groupe seul', async () => {
    await deleteRecipientGroupService(scopeInput)

    expect(deleteRecipientGroupTxnDao).toHaveBeenCalledWith(GROUP_ID)
    expect(addRecipientGroupMembersTxnDao).not.toHaveBeenCalled()
    expect(removeRecipientGroupMembersTxnDao).not.toHaveBeenCalled()
  })

  it('un groupe introuvable est introuvable', async () => {
    vi.mocked(deleteRecipientGroupTxnDao).mockResolvedValue(undefined)

    await expect(
      deleteRecipientGroupService(scopeInput)
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('un groupe ouvert — sa composition comptée comme la cible (critère 5)', () => {
  it('compte en fiches, puis en adresses, sur les seules fiches du groupe', async () => {
    vi.mocked(getCampaignTargetRowsDao).mockResolvedValue([
      targetRow(PROFILE_A, 'a@x.fr'),
      targetRow(PROFILE_B, null),
      targetRow('hors-groupe', 'z@x.fr'),
    ])

    const group = await getRecipientGroupService(scopeInput)

    expect(group).toEqual({
      ...groupRow(),
      counts: {
        profilesWithEmail: 1,
        profilesWithoutEmail: 1,
        profiles: 2,
        recipients: 1,
        unsubscribed: 0,
        reinstated: 0,
        nature: 'facultative',
      },
    })
  })

  it('rend `undefined` pour un groupe introuvable ou d’une autre association', async () => {
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue(undefined)

    expect(await getRecipientGroupService(scopeInput)).toBeUndefined()
  })
})
