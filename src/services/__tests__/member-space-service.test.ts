import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const outer = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = outer
    }
  }),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfilesByUserIdDao: vi.fn(),
  updateMyMemberProfilesContactDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({}))
vi.mock('@/db/repositories/user-repository', () => ({}))
vi.mock('@/db/repositories/member-role-event-repository', () => ({}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  getCurrentParcelsByMemberDao: vi.fn(),
  getFormerParcelsByMemberDao: vi.fn(),
  getMemberFormerParcelsDao: vi.fn(),
  listOwnershipPeriodsByProfilesDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  getOrganizationSettingsDao: vi.fn(async () => []),
}))

import {
  getMemberProfilesByUserIdDao,
  updateMyMemberProfilesContactDao,
} from '@/db/repositories/member-profile-repository'
import {
  getCurrentParcelsByMemberDao,
  getFormerParcelsByMemberDao,
  getMemberFormerParcelsDao,
  listOwnershipPeriodsByProfilesDao,
} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {AuthorizationError} from '../errors/authorization-error'
import {
  getMyContactService,
  getMyLandsService,
  isPlainMemberOfService,
  updateMyContactService,
} from '../member-space-service'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const BUYER_ID = '44444444-4444-4444-8444-444444444444'

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

const profileRow = {
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Lucie Moreau',
  email: 'lucie.moreau@example.test',
  phone: null,
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
  pennylaneCustomerId: null,
  pennylaneImportSnapshot: null,
  pennylaneImportedAt: null,
  mailOnly: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  currentParcelNumbers: ['21', '3'],
}

const SCI_ID = '55555555-5555-4555-8555-555555555555'
const LAND_27_ID = '66666666-6666-4666-8666-666666666666'

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([profileRow])
  vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
  vi.mocked(getCurrentParcelsByMemberDao).mockResolvedValue([
    {
      parcelId: 'p21',
      number: '21',
      startsOn: '2011-04-02',
      meterNumber: '0045821',
    },
    {parcelId: 'p3', number: '3', startsOn: '2015-01-10', meterNumber: null},
  ])
  vi.mocked(getFormerParcelsByMemberDao).mockResolvedValue([
    {
      parcelId: 'p9',
      number: '9',
      startsOn: '2003-05-14',
      endsOn: '2019-10-01',
      buyerId: BUYER_ID,
      buyerName: 'Marcel Laurent',
    },
  ])
  vi.mocked(getMemberFormerParcelsDao).mockResolvedValue([
    {number: '9', startsOn: '2003-05-14', endsOn: '2019-10-01'},
  ])
})

describe('[ORGANIZATION MEMBER] getMyLandsService — « Mes terrains » (s53, critères 2 et 4)', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('member'))
  })

  it('résout les fiches par l’association et le compte de la session, sous le scope', async () => {
    let readUnder: string | undefined
    vi.mocked(getMemberProfilesByUserIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return [profileRow]
    })

    await getMyLandsService(ORG_ID)

    expect(getMemberProfilesByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      userTest.id
    )
    expect(readUnder).toBe(ORG_ID)
    expect(getCurrentParcelsByMemberDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(getMemberFormerParcelsDao).toHaveBeenCalledWith(PROFILE_ID)
  })

  it('lit les anciennes parcelles sans charger l’acquéreur (revue n° 1, mineur 5)', async () => {
    await getMyLandsService(ORG_ID)

    expect(getMemberFormerParcelsDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(getFormerParcelsByMemberDao).not.toHaveBeenCalled()
  })

  it('un seul terrain : parcelles actuelles avec leur compteur, anciennes, sans l’acquéreur', async () => {
    const lands = await getMyLandsService(ORG_ID)

    expect(lands).toEqual({
      accountName: userTest.name,
      lands: [
        {
          name: 'Lucie Moreau',
          current: [
            {number: '3', startsOn: '2015-01-10', meterNumber: null},
            {number: '21', startsOn: '2011-04-02', meterNumber: '0045821'},
          ],
          former: [{number: '9', startsOn: '2003-05-14', endsOn: '2019-10-01'}],
        },
      ],
    })
    expect(JSON.stringify(lands)).not.toContain('Marcel Laurent')
    expect(JSON.stringify(lands)).not.toContain(BUYER_ID)
    expect(JSON.stringify(lands)).not.toContain(PROFILE_ID)
  })

  it('un compte à trois fiches : un terrain par fiche, dans l’ordre des parcelles, anciennes par fiche', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      {
        ...profileRow,
        id: SCI_ID,
        name: 'SCI Les Pins',
        currentParcelNumbers: [],
      },
      {...profileRow, id: LAND_27_ID, currentParcelNumbers: ['27']},
      {...profileRow, currentParcelNumbers: ['12']},
    ])
    vi.mocked(getCurrentParcelsByMemberDao).mockImplementation(async (id) =>
      id === PROFILE_ID
        ? [
            {
              parcelId: 'p12',
              number: '12',
              startsOn: '1998-02-03',
              meterNumber: '0045821',
            },
          ]
        : id === LAND_27_ID
          ? [
              {
                parcelId: 'p27',
                number: '27',
                startsOn: '2004-06-01',
                meterNumber: null,
              },
            ]
          : []
    )
    vi.mocked(getMemberFormerParcelsDao).mockImplementation(async (id) =>
      id === SCI_ID
        ? [{number: '8', startsOn: '2001-01-01', endsOn: '2010-01-01'}]
        : []
    )

    const lands = await getMyLandsService(ORG_ID)

    expect(lands?.lands.map((land) => land.name)).toEqual([
      'Lucie Moreau',
      'Lucie Moreau',
      'SCI Les Pins',
    ])
    expect(lands?.lands[0].current).toEqual([
      {number: '12', startsOn: '1998-02-03', meterNumber: '0045821'},
    ])
    expect(lands?.lands[1].current[0].number).toBe('27')
    expect(lands?.lands[2]).toEqual({
      name: 'SCI Les Pins',
      current: [],
      former: [{number: '8', startsOn: '2001-01-01', endsOn: '2010-01-01'}],
    })
    expect(lands?.lands[0].former).toEqual([])
    expect(JSON.stringify(lands)).not.toContain(SCI_ID)
  })

  it('ne rend rien pour un compte sans fiche dans l’association', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    expect(await getMyLandsService(ORG_ID)).toBeUndefined()
    expect(getCurrentParcelsByMemberDao).not.toHaveBeenCalled()
    expect(getMemberFormerParcelsDao).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association malformé, sans rien lire', async () => {
    await expect(getMyLandsService('pas-un-uuid')).rejects.toThrow()

    expect(getMemberProfilesByUserIdDao).not.toHaveBeenCalled()
  })
})

describe('[SUPER_ADMIN] getMyLandsService', () => {
  it('ne lit que les fiches liées à son propre compte', async () => {
    setupAuthUserMocked(userTestSuperAdmin)
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    expect(await getMyLandsService(ORG_ID)).toBeUndefined()
    expect(getMemberProfilesByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      userTestSuperAdmin.id
    )
  })
})

describe('[PUBLIC] getMyLandsService', () => {
  it('refuse sans session, sans rien lire', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyLandsService(ORG_ID)).rejects.toThrow(AuthorizationError)
    expect(getMemberProfilesByUserIdDao).not.toHaveBeenCalled()
  })
})

describe('isPlainMemberOfService — qui voit l’écran C4', () => {
  it.each([
    ['[ORGANIZATION MEMBER]', withRole('member'), true],
    ['[ORGANIZATION ADMIN]', withRole('board'), false],
    ['[ORGANIZATION OWNER]', withRole('owner'), false],
    ['[USER NOT IN ORGANIZATION]', withRole('member', OTHER_ORG_ID), false],
    ['[SUPER_ADMIN]', userTestSuperAdmin, false],
    ['[PUBLIC]', undefined, false],
  ])('%s → %s', async (_label, user, expected) => {
    setupAuthUserMocked(user)

    expect(await isPlainMemberOfService(ORG_ID)).toBe(expected)
  })
})

const NEW_CONTACT = {
  phone: '06 12 34 56 78',
  homeAddressLine: '4 chemin des Oliviers',
  homeAddressComplement: 'Bâtiment B',
  homePostalCode: '13100',
  homeCity: 'Aix-en-Provence',
}

describe('[PUBLIC] updateMyContactService — autorisation d’abord (s16, critère 3)', () => {
  it('refuse sans session, sans rien lire ni écrire', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      updateMyContactService({organizationId: ORG_ID, ...NEW_CONTACT})
    ).rejects.toThrow(AuthorizationError)
    expect(updateMyMemberProfilesContactDao).not.toHaveBeenCalled()
    expect(getMemberProfilesByUserIdDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION MEMBER] updateMyContactService — « Mes coordonnées » (s16)', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(updateMyMemberProfilesContactDao).mockResolvedValue([
      {...profileRow, ...NEW_CONTACT},
    ])
  })

  it('écrit les fiches du compte de la session : un identifiant de fiche glissé dans l’entrée est retiré (critère 4)', async () => {
    await updateMyContactService({
      organizationId: ORG_ID,
      ...NEW_CONTACT,
      memberProfileId: BUYER_ID,
      email: 'autre.membre@example.test',
    } as Parameters<typeof updateMyContactService>[0])

    expect(updateMyMemberProfilesContactDao).toHaveBeenCalledWith(
      ORG_ID,
      userTest.id,
      [PROFILE_ID],
      NEW_CONTACT
    )
  })

  it('n’écrit jamais l’email (ADR 040)', async () => {
    await updateMyContactService({
      organizationId: ORG_ID,
      ...NEW_CONTACT,
      email: 'autre.membre@example.test',
    } as Parameters<typeof updateMyContactService>[0])

    const written = vi.mocked(updateMyMemberProfilesContactDao).mock.calls[0][3]
    expect(written).not.toHaveProperty('email')
  })

  it('écrit sous le scope de l’association donnée', async () => {
    let writtenUnder: string | undefined
    vi.mocked(updateMyMemberProfilesContactDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return [{...profileRow, ...NEW_CONTACT}]
    })

    await updateMyContactService({organizationId: ORG_ID, ...NEW_CONTACT})

    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    expect(writtenUnder).toBe(ORG_ID)
  })

  it('rend les coordonnées enregistrées, sans identifiant de fiche ni de compte', async () => {
    const result = await updateMyContactService({
      organizationId: ORG_ID,
      ...NEW_CONTACT,
    })

    expect(result).toEqual({
      status: 'saved',
      contact: {
        ...NEW_CONTACT,
        landCount: 1,
        divergent: false,
        groups: [],
      },
    })
    expect(JSON.stringify(result)).not.toContain(PROFILE_ID)
    expect(JSON.stringify(result)).not.toContain(userTest.id)
  })

  it('rend `not_found` pour un compte sans fiche dans l’association', async () => {
    vi.mocked(updateMyMemberProfilesContactDao).mockResolvedValue([])

    expect(
      await updateMyContactService({organizationId: ORG_ID, ...NEW_CONTACT})
    ).toEqual({status: 'not_found'})
  })

  it('écrit toutes les fiches du compte d’un coup et rend leur nombre (s53, arbitrage du 16/11)', async () => {
    vi.mocked(updateMyMemberProfilesContactDao).mockResolvedValue([
      {...profileRow, ...NEW_CONTACT, currentParcelNumbers: []},
      {...profileRow, ...NEW_CONTACT, id: SCI_ID, name: 'SCI Les Pins'},
      {...profileRow, ...NEW_CONTACT, id: LAND_27_ID},
    ] as never)

    const result = await updateMyContactService({
      organizationId: ORG_ID,
      ...NEW_CONTACT,
    })

    expect(updateMyMemberProfilesContactDao).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      status: 'saved',
      contact: {...NEW_CONTACT, landCount: 3, divergent: false, groups: []},
    })
  })

  it('n’écrit ni le terrain ni le nom de l’entreprise : retirés par Zod (s55, critère 5)', async () => {
    await updateMyContactService({
      organizationId: ORG_ID,
      ...NEW_CONTACT,
      landAddressLine: '3 allée des Mimosas',
      landPostalCode: '40600',
      landCity: 'Biscarrosse',
      companyName: 'Épicerie fictive',
    } as Parameters<typeof updateMyContactService>[0])

    const written = vi.mocked(updateMyMemberProfilesContactDao).mock.calls[0][3]
    expect(written).toEqual(NEW_CONTACT)
    expect(written).not.toHaveProperty('landAddressLine')
    expect(written).not.toHaveProperty('companyName')
  })

  it('refuse une saisie invalide, sans rien écrire', async () => {
    await expect(
      updateMyContactService({
        organizationId: ORG_ID,
        ...NEW_CONTACT,
        homePostalCode: '1310',
      })
    ).rejects.toThrow()
    expect(updateMyMemberProfilesContactDao).not.toHaveBeenCalled()
  })
})

describe('getMyContactService — lecture de « Mes coordonnées » (s16)', () => {
  it('[PUBLIC] refuse sans session, sans rien lire', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyContactService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getMemberProfilesByUserIdDao).not.toHaveBeenCalled()
  })

  it('[ORGANIZATION MEMBER] lit la fiche du compte de la session, sous le scope', async () => {
    setupAuthUserMocked(withRole('member'))
    let readUnder: string | undefined
    vi.mocked(getMemberProfilesByUserIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return [{...profileRow, ...NEW_CONTACT}]
    })

    const contact = await getMyContactService(ORG_ID)

    expect(getMemberProfilesByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      userTest.id
    )
    expect(readUnder).toBe(ORG_ID)
    expect(contact).toEqual({
      ...NEW_CONTACT,
      landCount: 1,
      divergent: false,
      groups: [],
    })
    expect(contact).not.toHaveProperty('id')
    expect(contact).not.toHaveProperty('email')
    expect(contact).not.toHaveProperty('userId')
  })

  it('[ORGANIZATION MEMBER] ne rend rien pour un compte sans fiche', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    expect(await getMyContactService(ORG_ID)).toBeUndefined()
  })

  it('[ORGANIZATION MEMBER] coordonnées divergentes : celles du premier terrain, et un groupe par jeu (2b, s53)', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      {
        ...profileRow,
        id: SCI_ID,
        name: 'SCI Les Pins',
        currentParcelNumbers: ['31'],
        phone: '05 00 00 00 00',
      },
      {
        ...profileRow,
        ...NEW_CONTACT,
        id: LAND_27_ID,
        currentParcelNumbers: ['27'],
      },
      {...profileRow, ...NEW_CONTACT, currentParcelNumbers: ['12']},
    ])

    const contact = await getMyContactService(ORG_ID)

    expect(contact).toMatchObject({
      ...NEW_CONTACT,
      landCount: 3,
      divergent: true,
    })
    expect(contact?.groups).toEqual([
      {
        parcelNumbers: ['12', '27'],
        names: ['Lucie Moreau'],
        ...NEW_CONTACT,
      },
      {
        parcelNumbers: ['31'],
        names: ['SCI Les Pins'],
        phone: '05 00 00 00 00',
        homeAddressLine: null,
        homeAddressComplement: null,
        homePostalCode: null,
        homeCity: null,
      },
    ])
    expect(JSON.stringify(contact)).not.toContain(SCI_ID)
  })

  it('[ORGANIZATION MEMBER] un terrain différent ne crée pas de groupe divergent : seul le domicile compte (s55)', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      {
        ...profileRow,
        ...NEW_CONTACT,
        landAddressLine: '3 allée des Mimosas',
        landCity: 'Biscarrosse',
        currentParcelNumbers: ['12'],
      },
      {
        ...profileRow,
        ...NEW_CONTACT,
        id: SCI_ID,
        name: 'SCI Les Pins',
        landAddressLine: '8 allée des Arbousiers',
        landCity: 'Lacanau',
        companyName: 'SCI Les Pins',
        currentParcelNumbers: ['31'],
      },
    ])

    const contact = await getMyContactService(ORG_ID)

    expect(contact).toEqual({
      ...NEW_CONTACT,
      landCount: 2,
      divergent: false,
      groups: [],
    })
    expect(contact).not.toHaveProperty('landAddressLine')
    expect(contact).not.toHaveProperty('companyName')
  })

  it('[ORGANIZATION MEMBER] un groupe ne nomme pas les fiches qui portent le nom du compte (2b)', async () => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      {...profileRow, name: userTest.name, currentParcelNumbers: ['12']},
      {
        ...profileRow,
        ...NEW_CONTACT,
        id: SCI_ID,
        name: 'SCI Les Pins',
        currentParcelNumbers: ['31'],
      },
    ])

    const contact = await getMyContactService(ORG_ID)

    expect(contact?.groups.map((group) => group.names)).toEqual([
      [],
      ['SCI Les Pins'],
    ])
  })
})

describe('[ORGANIZATION MEMBER] accès après la vente — l’espace membre écarte une fiche fermée (s57, critères 2 et 4)', () => {
  const SOLD_ID = '77777777-7777-4777-8777-777777777777'
  const soldRow = {
    ...profileRow,
    id: SOLD_ID,
    name: 'Lucie Moreau',
    phone: '05 00 00 00 00',
    currentParcelNumbers: [],
  }

  beforeEach(() => {
    setupAuthUserMocked(withRole('member'))
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      soldRow,
      {...profileRow, ...NEW_CONTACT},
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      {
        memberProfileId: SOLD_ID,
        number: '9',
        meterNumber: null,
        startsOn: '2003-05-14',
        endsOn: '2019-10-01',
      },
      {
        memberProfileId: PROFILE_ID,
        number: '21',
        meterNumber: null,
        startsOn: '2011-04-02',
        endsOn: null,
      },
    ])
  })

  it('« Mes terrains » ne montre pas la fiche fermée', async () => {
    const lands = await getMyLandsService(ORG_ID)

    expect(lands?.lands).toHaveLength(1)
    expect(getCurrentParcelsByMemberDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(getCurrentParcelsByMemberDao).not.toHaveBeenCalledWith(SOLD_ID)
  })

  it('les coordonnées ne lisent pas la fiche fermée', async () => {
    expect(await getMyContactService(ORG_ID)).toEqual({
      ...NEW_CONTACT,
      landCount: 1,
      divergent: false,
      groups: [],
    })
  })

  it('la correction des coordonnées n’écrit que les fiches accessibles', async () => {
    vi.mocked(updateMyMemberProfilesContactDao).mockResolvedValue([
      {...profileRow, ...NEW_CONTACT},
    ])

    await updateMyContactService({organizationId: ORG_ID, ...NEW_CONTACT})

    expect(updateMyMemberProfilesContactDao).toHaveBeenCalledWith(
      ORG_ID,
      userTest.id,
      [PROFILE_ID],
      NEW_CONTACT
    )
  })

  it('toutes les fiches fermées : rien n’est écrit, `not_found`', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([soldRow])

    expect(
      await updateMyContactService({organizationId: ORG_ID, ...NEW_CONTACT})
    ).toEqual({status: 'not_found'})
    expect(updateMyMemberProfilesContactDao).not.toHaveBeenCalled()
  })
})
