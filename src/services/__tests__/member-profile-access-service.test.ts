import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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
  getMemberProfilesByUserIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  getOrganizationSettingsDao: vi.fn(),
}))

import {getMemberProfilesByUserIdDao} from '@/db/repositories/member-profile-repository'
import {getOrganizationSettingsDao} from '@/db/repositories/organization-setting-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {
  getMyAccessibleProfiles,
  hasMemberSpaceAccessService,
} from '../member-profile-access-service'
import {MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY} from '../types/domain/association-settings-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'user-lefevre'
const FICHE_1 = '33333333-3333-4333-8333-333333333331'
const FICHE_2 = '33333333-3333-4333-8333-333333333332'
const FICHE_3 = '33333333-3333-4333-8333-333333333333'

const SALE = '2026-06-15'
const NOON = 'T10:00:00Z'

const profile = (id: string, currentParcelNumbers: string[] = []) => ({
  id,
  organizationId: ORG_ID,
  name: `Fiche ${id.slice(-1)}`,
  email: null,
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
  mailOnly: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  currentParcelNumbers,
})

const period = (
  memberProfileId: string,
  number: string,
  startsOn: string,
  endsOn: string | null
) => ({memberProfileId, number, meterNumber: null, startsOn, endsOn})

const today = (day: string) => vi.setSystemTime(new Date(`${day}${NOON}`))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  scope.current = undefined
  vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
    {key: MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY, value: '6'},
  ] as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('critère 3 — contrôle à la lecture, horloge doublée autour de l’échéance', () => {
  beforeEach(() => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      profile(FICHE_1),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(FICHE_1, '47', '1998-02-03', SALE),
    ])
  })

  it('un jour avant l’échéance, la session reste ouverte et la fiche est en délai', async () => {
    today('2026-12-14')

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
    const profiles = await getMyAccessibleProfiles(ORG_ID, USER_ID)
    expect(profiles.map(({id, access}) => ({id, access}))).toEqual([
      {
        id: FICHE_1,
        access: {status: 'grace', soldOn: SALE, closesOn: '2026-12-15'},
      },
    ])
  })

  it('un jour après l’échéance, la session est refusée et la fiche sort', async () => {
    today('2026-12-16')

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(false)
    expect(await getMyAccessibleProfiles(ORG_ID, USER_ID)).toEqual([])
  })

  it('lit le délai du tenant : allongé, il rouvre la fiche déjà fermée', async () => {
    today('2026-12-16')
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      {key: MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY, value: '12'},
    ] as never)

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
  })

  it('lit sous le scope de l’association passée', async () => {
    today('2026-12-14')
    vi.mocked(getMemberProfilesByUserIdDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return [profile(FICHE_1)]
    })
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockImplementation(
      async (ids) => {
        expect(scope.current).toBe(ORG_ID)
        expect(ids).toEqual([FICHE_1])
        return [period(FICHE_1, '47', '1998-02-03', SALE)]
      }
    )

    await hasMemberSpaceAccessService(ORG_ID, USER_ID)

    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    expect(getMemberProfilesByUserIdDao).toHaveBeenCalledWith(ORG_ID, USER_ID)
  })
})

describe('critères 2 et 4 — Lefèvre vend la fiche 1, garde les fiches 2 et 3', () => {
  beforeEach(() => {
    today('2027-01-10')
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      profile(FICHE_1),
      profile(FICHE_3, ['31']),
      profile(FICHE_2, ['27']),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(FICHE_1, '12', '2005-01-01', SALE),
      period(FICHE_2, '27', '2005-01-01', null),
      period(FICHE_3, '31', '2008-01-01', null),
    ])
  })

  it('la session reste ouverte', async () => {
    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
  })

  it('la fiche 1 est absente passé le délai ; les autres restent, dans l’ordre de l’ADR 054', async () => {
    const profiles = await getMyAccessibleProfiles(ORG_ID, USER_ID)

    expect(profiles.map(({id, access}) => ({id, access}))).toEqual([
      {id: FICHE_2, access: {status: 'owner'}},
      {id: FICHE_3, access: {status: 'owner'}},
    ])
  })
})

describe('critère 5 — le proche d’une fiche vendue, titulaire ailleurs', () => {
  it('sa fiche garde l’accès, la fiche vendue sort', async () => {
    today('2027-01-10')
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      profile(FICHE_1),
      profile(FICHE_2, ['8']),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(FICHE_1, '12', '2005-01-01', SALE),
      period(FICHE_2, '8', '2010-01-01', null),
    ])

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
    expect(
      (await getMyAccessibleProfiles(ORG_ID, USER_ID)).map(({id}) => id)
    ).toEqual([FICHE_2])
  })
})

describe('critère 7 — rachat', () => {
  beforeEach(() => today('2027-01-10'))

  it('une nouvelle période sur la même fiche la rouvre', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      profile(FICHE_1, ['50']),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(FICHE_1, '12', '2005-01-01', SALE),
      period(FICHE_1, '50', '2027-01-05', null),
    ])

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
    expect(
      (await getMyAccessibleProfiles(ORG_ID, USER_ID)).map(({id}) => id)
    ).toEqual([FICHE_1])
  })

  it('un rachat sur une nouvelle fiche rouvre la session, l’ancienne reste fermée', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      profile(FICHE_1),
      profile(FICHE_2, ['50']),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      period(FICHE_1, '12', '2005-01-01', SALE),
      period(FICHE_2, '50', '2027-01-05', null),
    ])

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
    expect(
      (await getMyAccessibleProfiles(ORG_ID, USER_ID)).map(({id}) => id)
    ).toEqual([FICHE_2])
  })
})

describe('hors règle', () => {
  beforeEach(() => today('2027-01-10'))

  it('une fiche sans aucune période reste ouverte', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      profile(FICHE_1),
    ])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
    expect(await getMyAccessibleProfiles(ORG_ID, USER_ID)).toMatchObject([
      {id: FICHE_1, access: {status: 'out_of_rule'}},
    ])
  })

  it('un compte sans aucune fiche reliée garde la session', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])

    expect(await hasMemberSpaceAccessService(ORG_ID, USER_ID)).toBe(true)
  })
})
