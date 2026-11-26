import {createHash} from 'node:crypto'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  deletePendingEmailsAddedByDao: vi.fn(),
  deleteMemberProfileEmailDao: vi.fn(),
  getActiveEmailCarriersDao: vi.fn(),
  getMemberProfileEmailsByTokenHashDao: vi.fn(),
  getMemberProfileEmailsDao: vi.fn(),
  purgeExpiredPendingEmailsDao: vi.fn(),
  updateMemberProfileEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  countLinkedProfilesDao: vi.fn(),
  getCurrentParcelNumbersByProfileDao: vi.fn(),
  getLinkedAccountsDao: vi.fn(),
  getMemberProfileByIdDao: vi.fn(),
  getMemberProfilesByUserIdDao: vi.fn(),
  linkMemberProfileAccountDao: vi.fn(),
  unlinkMemberProfileAccountDao: vi.fn(),
  getUnlinkedMemberProfilesWithEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  createUserIfAbsentTxnDao: vi.fn(),
  getUserByEmailDao: vi.fn(),
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  getOrganizationSettingsDao: vi.fn(async () => []),
}))
vi.mock('@/db/repositories/member-role-event-repository', () => ({
  insertMemberRoleEventDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  createMemberIfAbsentTxnDao: vi.fn(),
  deleteMemberWithRoleDao: vi.fn(),
  getMemberAccountDao: vi.fn(),
  getUserOrganizationDao: vi.fn(),
  lockOrganizationRolesDao: vi.fn(),
  updateMemberRoleFromDao: vi.fn(),
}))

import {
  deletePendingEmailsAddedByDao,
  getActiveEmailCarriersDao,
  getMemberProfileEmailsByTokenHashDao,
  getMemberProfileEmailsDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {
  getCurrentParcelNumbersByProfileDao,
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  getMemberProfilesByUserIdDao,
  linkMemberProfileAccountDao,
  unlinkMemberProfileAccountDao,
} from '@/db/repositories/member-profile-repository'
import {
  createMemberIfAbsentTxnDao,
  getUserOrganizationDao,
} from '@/db/repositories/organization-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {
  createUserIfAbsentTxnDao,
  getUserByEmailDao,
  getUserByIdDao,
} from '@/db/repositories/user-repository'

import {getAuthUser} from '../authentication/auth-service'
import {
  confirmMemberEmailService,
  getMemberEmailConfirmationStateService,
} from '../member-email-confirmation-service'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const CLAIRE_ID = '55555555-5555-4555-8555-555555555555'
const MARC_USER_ID = '66666666-6666-4666-8666-666666666666'
const PENDING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')
const HASH = createHash('sha256').update(TOKEN).digest('hex')
const LATER = new Date('2999-01-01T00:00:00Z')

const pendingRow = (overrides: Record<string, unknown> = {}) => ({
  id: PENDING_ID,
  organizationId: ORG_ID,
  memberProfileId: PROFILE_ID,
  email: 'marc@exemple.fr',
  role: 'additional',
  status: 'pending',
  origin: 'site',
  addedByUserId: CLAIRE_ID,
  addedByName: 'Claire Dubois',
  replacesEmailId: null,
  confirmationTokenHash: HASH,
  expiresAt: LATER,
  unsubscribedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const input = {organizationId: ORG_ID, token: TOKEN}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
    pendingRow(),
  ] as never)
  vi.mocked(getMemberProfileEmailsDao).mockResolvedValue([
    {
      ...pendingRow({
        id: 'holder',
        email: 'jean@exemple.fr',
        role: 'holder',
        status: 'active',
        addedByUserId: null,
        confirmationTokenHash: null,
        expiresAt: null,
      }),
    },
    pendingRow(),
  ] as never)
  vi.mocked(getActiveEmailCarriersDao).mockResolvedValue([])
  vi.mocked(getUserOrganizationDao).mockImplementation(
    async (userId, organizationId) =>
      ({
        id: `membership-${userId}`,
        organizationId,
        userId,
        role: 'member',
        createdAt: new Date(),
      }) as never
  )
  vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
    {id: PROFILE_ID, currentParcelNumbers: []} as never,
  ])
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue({
    id: PROFILE_ID,
    name: 'Jean Dubois',
  } as never)
  vi.mocked(getLinkedAccountsDao).mockResolvedValue([])
  vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
  vi.mocked(getCurrentParcelNumbersByProfileDao).mockResolvedValue({
    [PROFILE_ID]: ['21'],
  })
  vi.mocked(getUserByIdDao).mockResolvedValue({
    id: CLAIRE_ID,
    name: 'Claire Dubois',
  } as never)
  vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
  vi.mocked(createUserIfAbsentTxnDao).mockResolvedValue({id: MARC_USER_ID})
  vi.mocked(createMemberIfAbsentTxnDao).mockResolvedValue({
    role: 'member',
  } as never)
})

describe('[PUBLIC] getMemberEmailConfirmationStateService — lecture seule (3a)', () => {
  it('lit l’adresse en attente par le hash du jeton, sans rien écrire', async () => {
    await expect(
      getMemberEmailConfirmationStateService(input)
    ).resolves.toEqual({
      status: 'confirm',
      email: 'marc@exemple.fr',
      parcelNumbers: ['21'],
    })
    expect(getMemberProfileEmailsByTokenHashDao).toHaveBeenCalledWith(HASH)
    expect(getMemberProfileEmailsByTokenHashDao).not.toHaveBeenCalledWith(TOKEN)
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(getAuthUser).not.toHaveBeenCalled()
  })

  it.each([
    ['inconnu, annulé ou déjà utilisé', []],
    ['expiré', [pendingRow({expiresAt: new Date('2000-01-01T00:00:00Z')})]],
    ['d’une adresse déjà active', [pendingRow({status: 'active'})]],
  ])('jeton %s → un seul état « lien inutilisable » (3c)', async (_l, rows) => {
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue(
      rows as never
    )

    await expect(
      getMemberEmailConfirmationStateService(input)
    ).resolves.toEqual({status: 'invalid'})
  })

  it('jeton hors forme → invalid, sans requête', async () => {
    await expect(
      getMemberEmailConfirmationStateService({...input, token: 'court'})
    ).resolves.toEqual({status: 'invalid'})
    expect(getMemberProfileEmailsByTokenHashDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] confirmMemberEmailService — le bouton (3b, 3c, 3d)', () => {
  it('active l’adresse, efface le jeton et ouvre son compte relié à la fiche (critère 5)', async () => {
    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'confirmed',
      replaced: false,
    })

    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(PENDING_ID, {
      email: 'marc@exemple.fr',
      role: 'additional',
      status: 'active',
      confirmationTokenHash: null,
      expiresAt: null,
    })
    expect(linkMemberProfileAccountDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      userId: MARC_USER_ID,
    })
  })

  it.each([
    ['inconnu, annulé ou déjà utilisé', []],
    ['expiré', [pendingRow({expiresAt: new Date('2000-01-01T00:00:00Z')})]],
  ])('jeton %s → invalid, rien n’est activé', async (_l, rows) => {
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue(
      rows as never
    )

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'invalid',
    })
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
  })

  it('adresse prise entre-temps par une fiche non reliée à l’auteur → 3d, rien n’est activé (critère 7)', async () => {
    vi.mocked(getActiveEmailCarriersDao).mockResolvedValue([
      {id: 'ailleurs', memberProfileId: OTHER_PROFILE_ID, role: 'holder'},
    ])

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'taken',
    })
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
  })

  it('une modification confirmée remplace l’ancienne adresse : titre transmis, ancien compte délié', async () => {
    const OLD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const OLD_USER_ID = '77777777-7777-4777-8777-777777777777'
    const replacing = pendingRow({
      email: 'jean.nouveau@exemple.fr',
      replacesEmailId: OLD_ID,
      addedByUserId: OLD_USER_ID,
    })
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
      replacing,
    ] as never)
    vi.mocked(getMemberProfileEmailsDao).mockResolvedValue([
      pendingRow({
        id: OLD_ID,
        email: 'jean@exemple.fr',
        role: 'holder',
        status: 'active',
        addedByUserId: null,
        confirmationTokenHash: null,
        expiresAt: null,
      }),
      replacing,
    ] as never)
    vi.mocked(getLinkedAccountsDao).mockResolvedValue([
      {userId: OLD_USER_ID, email: 'jean@exemple.fr', name: 'Jean Dubois'},
    ])
    vi.mocked(getUserByIdDao).mockResolvedValue({
      id: OLD_USER_ID,
      name: 'Jean Dubois',
    } as never)

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'confirmed',
      replaced: true,
    })
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      PENDING_ID,
      expect.objectContaining({role: 'holder', status: 'active'})
    )
    expect(unlinkMemberProfileAccountDao).toHaveBeenCalledWith(
      PROFILE_ID,
      OLD_USER_ID
    )
    expect(deletePendingEmailsAddedByDao).toHaveBeenCalledWith(
      PROFILE_ID,
      OLD_USER_ID
    )
  })
})

describe('[PUBLIC] l’auteur n’est plus relié à la fiche (revue C1, ADR 056 §5)', () => {
  it('scénario de la revue : un proche ajoute X, le bureau retire son adresse, il clique → le même « lien inutilisable » (3c), X n’est pas activée, aucun compte relié', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'invalid',
    })
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
  })

  it('la page montre le même « lien inutilisable » (3c) que tout autre cas, sans en dire la cause ni rien écrire (revue MA1)', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    await expect(
      getMemberEmailConfirmationStateService(input)
    ).resolves.toEqual({status: 'invalid'})
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('un lien sur deux fiches : seule celle encore reliée à l’auteur est activée', async () => {
    const OTHER_PENDING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
      pendingRow(),
      pendingRow({id: OTHER_PENDING_ID, memberProfileId: OTHER_PROFILE_ID}),
    ] as never)
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      {id: OTHER_PROFILE_ID, currentParcelNumbers: []} as never,
    ])
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue({
      id: OTHER_PROFILE_ID,
      name: 'Jean Dubois',
    } as never)
    vi.mocked(getMemberProfileEmailsDao).mockResolvedValue([
      pendingRow({id: OTHER_PENDING_ID, memberProfileId: OTHER_PROFILE_ID}),
    ] as never)

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'confirmed',
      replaced: false,
    })
    expect(getMemberProfileByIdDao).toHaveBeenCalledTimes(1)
    expect(getMemberProfileByIdDao).toHaveBeenCalledWith(OTHER_PROFILE_ID)
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalledWith(
      PENDING_ID,
      expect.anything()
    )
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      OTHER_PENDING_ID,
      expect.objectContaining({status: 'active'})
    )
  })

  it('la page ne montre que les parcelles des fiches encore reliées à l’auteur', async () => {
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
      pendingRow(),
      pendingRow({id: 'autre', memberProfileId: OTHER_PROFILE_ID}),
    ] as never)
    vi.mocked(getCurrentParcelNumbersByProfileDao).mockResolvedValue({
      [PROFILE_ID]: ['21'],
    })

    await expect(
      getMemberEmailConfirmationStateService(input)
    ).resolves.toEqual({
      status: 'confirm',
      email: 'marc@exemple.fr',
      parcelNumbers: ['21'],
    })
    expect(getCurrentParcelNumbersByProfileDao).toHaveBeenCalledWith([
      PROFILE_ID,
    ])
  })

  it('une attente sans auteur (compte de l’auteur supprimé) n’est pas activable : 3c, rien n’est activé (revue mi4)', async () => {
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
      pendingRow({addedByUserId: null}),
    ] as never)

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'invalid',
    })
    await expect(
      getMemberEmailConfirmationStateService(input)
    ).resolves.toEqual({status: 'invalid'})
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
  })

  it('un lien dont les attentes ont des auteurs différents : chaque attente est jugée sur son propre auteur', async () => {
    const OTHER_PENDING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const CLAIRE_NEW_ID = '88888888-8888-4888-8888-888888888888'
    vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
      pendingRow({addedByUserId: CLAIRE_NEW_ID}),
      pendingRow({id: OTHER_PENDING_ID, memberProfileId: OTHER_PROFILE_ID}),
    ] as never)
    vi.mocked(getMemberProfilesByUserIdDao).mockImplementation(
      async (_org, userId) =>
        (userId === CLAIRE_NEW_ID
          ? [{id: PROFILE_ID, currentParcelNumbers: []}]
          : [{id: OTHER_PROFILE_ID, currentParcelNumbers: []}]) as never
    )
    vi.mocked(getMemberProfileByIdDao).mockImplementation(
      async (id) => ({id, name: 'Jean Dubois'}) as never
    )
    vi.mocked(getMemberProfileEmailsDao).mockImplementation(
      async ([profileId]) =>
        [
          profileId === PROFILE_ID
            ? pendingRow({addedByUserId: CLAIRE_NEW_ID})
            : pendingRow({
                id: OTHER_PENDING_ID,
                memberProfileId: OTHER_PROFILE_ID,
              }),
        ] as never
    )

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'confirmed',
      replaced: false,
    })
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      PENDING_ID,
      expect.objectContaining({status: 'active'})
    )
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      OTHER_PENDING_ID,
      expect.objectContaining({status: 'active'})
    )
  })
})

describe('[PUBLIC] l’auteur relié à une fiche fermée après la vente (s57, ADR 075 §4)', () => {
  it('l’attente d’une fiche fermée n’est plus activable : 3c, rien n’est activé ni relié', async () => {
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      {
        memberProfileId: PROFILE_ID,
        number: '21',
        meterNumber: null,
        startsOn: '2003-05-14',
        endsOn: '2019-10-01',
      },
    ])

    await expect(confirmMemberEmailService(input)).resolves.toEqual({
      status: 'invalid',
    })
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
  })
})
