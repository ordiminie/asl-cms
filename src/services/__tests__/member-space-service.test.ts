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
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfileByUserIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  getCurrentParcelsByMemberDao: vi.fn(),
  getFormerParcelsByMemberDao: vi.fn(),
  getMemberFormerParcelsDao: vi.fn(),
}))

import {getMemberProfileByUserIdDao} from '@/db/repositories/member-profile-repository'
import {
  getCurrentParcelsByMemberDao,
  getFormerParcelsByMemberDao,
  getMemberFormerParcelsDao,
} from '@/db/repositories/parcel-ownership-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  getMyParcelsService,
  isPlainMemberOfService,
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
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
  userId: userTest.id,
  mailOnly: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(getMemberProfileByUserIdDao).mockResolvedValue(profileRow)
  vi.mocked(getCurrentParcelsByMemberDao).mockResolvedValue([
    {parcelId: 'p21', number: '21', startsOn: '2011-04-02'},
    {parcelId: 'p3', number: '3', startsOn: '2015-01-10'},
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

describe('[ORGANIZATION MEMBER] getMyParcelsService — « Mes parcelles » (critère 4)', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('member'))
  })

  it('résout la fiche par l’association et le compte de la session, sous le scope', async () => {
    let readUnder: string | undefined
    vi.mocked(getMemberProfileByUserIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return profileRow
    })

    await getMyParcelsService(ORG_ID)

    expect(getMemberProfileByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      userTest.id
    )
    expect(readUnder).toBe(ORG_ID)
    expect(getCurrentParcelsByMemberDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(getMemberFormerParcelsDao).toHaveBeenCalledWith(PROFILE_ID)
  })

  it('lit les anciennes parcelles sans charger l’acquéreur (revue n° 1, mineur 5)', async () => {
    await getMyParcelsService(ORG_ID)

    expect(getMemberFormerParcelsDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(getFormerParcelsByMemberDao).not.toHaveBeenCalled()
  })

  it('rend parcelles actuelles et anciennes, sans l’acquéreur', async () => {
    const parcels = await getMyParcelsService(ORG_ID)

    expect(parcels).toEqual({
      name: 'Lucie Moreau',
      current: [
        {number: '3', startsOn: '2015-01-10'},
        {number: '21', startsOn: '2011-04-02'},
      ],
      former: [{number: '9', startsOn: '2003-05-14', endsOn: '2019-10-01'}],
    })
    expect(JSON.stringify(parcels)).not.toContain('Marcel Laurent')
    expect(JSON.stringify(parcels)).not.toContain(BUYER_ID)
    expect(JSON.stringify(parcels)).not.toContain(PROFILE_ID)
  })

  it('ne rend rien pour un compte sans fiche dans l’association', async () => {
    vi.mocked(getMemberProfileByUserIdDao).mockResolvedValue(undefined)

    expect(await getMyParcelsService(ORG_ID)).toBeUndefined()
    expect(getCurrentParcelsByMemberDao).not.toHaveBeenCalled()
    expect(getMemberFormerParcelsDao).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association malformé, sans rien lire', async () => {
    await expect(getMyParcelsService('pas-un-uuid')).rejects.toThrow()

    expect(getMemberProfileByUserIdDao).not.toHaveBeenCalled()
  })
})

describe('[SUPER_ADMIN] getMyParcelsService', () => {
  it('ne lit que la fiche liée à son propre compte', async () => {
    setupAuthUserMocked(userTestSuperAdmin)
    vi.mocked(getMemberProfileByUserIdDao).mockResolvedValue(undefined)

    expect(await getMyParcelsService(ORG_ID)).toBeUndefined()
    expect(getMemberProfileByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      userTestSuperAdmin.id
    )
  })
})

describe('[PUBLIC] getMyParcelsService', () => {
  it('refuse sans session, sans rien lire', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyParcelsService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getMemberProfileByUserIdDao).not.toHaveBeenCalled()
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
