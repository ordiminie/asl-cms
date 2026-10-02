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
  getMemberProfileByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  closeOpenPeriodTxnDao: vi.fn(),
  findOrCreateParcelTxnDao: vi.fn(),
  getCurrentParcelsByMemberDao: vi.fn(),
  getFormerParcelsByMemberDao: vi.fn(),
  getParcelByIdDao: vi.fn(),
  getParcelOwnerAtDao: vi.fn(),
  getParcelPeriodsDao: vi.fn(),
  lockParcelTxnDao: vi.fn(),
  openPeriodTxnDao: vi.fn(),
}))

import {getMemberProfileByIdDao} from '@/db/repositories/member-profile-repository'
import {
  closeOpenPeriodTxnDao,
  findOrCreateParcelTxnDao,
  getCurrentParcelsByMemberDao,
  getFormerParcelsByMemberDao,
  getParcelByIdDao,
  getParcelOwnerAtDao,
  getParcelPeriodsDao,
  lockParcelTxnDao,
  openPeriodTxnDao,
} from '@/db/repositories/parcel-ownership-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  attachParcelService,
  getMemberParcelsService,
  getParcelOwnerAtService,
  getSaleContextService,
  recordSaleService,
} from '../parcel-ownership-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const DUBOIS_ID = '33333333-3333-4333-8333-333333333333'
const ROY_ID = '44444444-4444-4444-8444-444444444444'
const BLANC_ID = '55555555-5555-4555-8555-555555555555'
const PARCEL_ID = '66666666-6666-4666-8666-666666666666'
const OTHER_PARCEL_ID = '77777777-7777-4777-8777-777777777777'
const DUBOIS_PERIOD_ID = '88888888-8888-4888-8888-888888888888'
const ROY_PERIOD_ID = '99999999-9999-4999-8999-999999999999'

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

const NAMES: Record<string, string> = {
  [DUBOIS_ID]: 'Jean et Odile Dubois',
  [ROY_ID]: 'Hélène Roy',
  [BLANC_ID]: 'Marc Blanc',
}

const profileRow = (id: string) => ({
  id,
  organizationId: ORG_ID,
  name: NAMES[id],
  email: null,
  phone: null,
  addressLine: '12 chemin des Pins',
  addressComplement: null,
  postalCode: '97400',
  city: 'Saint-Denis',
  mailOnly: true,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  updatedAt: new Date('2026-09-01T08:00:00Z'),
})

const parcelRow = (overrides: Record<string, unknown> = {}) => ({
  id: PARCEL_ID,
  organizationId: ORG_ID,
  number: '47',
  createdAt: new Date('2026-09-01T08:00:00Z'),
  ...overrides,
})

const periodRow = (
  id: string,
  memberProfileId: string,
  startsOn: string,
  endsOn: string | null
) => ({
  id,
  memberProfileId,
  memberName: NAMES[memberProfileId],
  startsOn,
  endsOn,
})

/** La parcelle 47 avant sa vente : Dubois depuis le 03/02/1998. */
const DUBOIS_OPEN = [periodRow(DUBOIS_PERIOD_ID, DUBOIS_ID, '1998-02-03', null)]

/** La parcelle 47 vendue : Dubois jusqu'au 15/06/2026, puis Roy. */
const SOLD = [
  periodRow(DUBOIS_PERIOD_ID, DUBOIS_ID, '1998-02-03', '2026-06-15'),
  periodRow(ROY_PERIOD_ID, ROY_ID, '2026-06-15', null),
]

const writeDaos = () => [
  closeOpenPeriodTxnDao,
  openPeriodTxnDao,
  findOrCreateParcelTxnDao,
]

const allDaos = () => [
  ...writeDaos(),
  getMemberProfileByIdDao,
  getCurrentParcelsByMemberDao,
  getFormerParcelsByMemberDao,
  getParcelByIdDao,
  getParcelOwnerAtDao,
  getParcelPeriodsDao,
  lockParcelTxnDao,
]

const order = (mock: unknown): number =>
  vi.mocked(mock as () => unknown).mock.invocationCallOrder[0]

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(getMemberProfileByIdDao).mockImplementation(async (id) =>
    NAMES[id] ? profileRow(id) : undefined
  )
  vi.mocked(findOrCreateParcelTxnDao).mockResolvedValue({
    row: parcelRow(),
    created: false,
  })
  vi.mocked(lockParcelTxnDao).mockResolvedValue(parcelRow())
  vi.mocked(getParcelByIdDao).mockResolvedValue(parcelRow())
  vi.mocked(getParcelPeriodsDao).mockResolvedValue([])
  vi.mocked(closeOpenPeriodTxnDao).mockResolvedValue(true)
  vi.mocked(openPeriodTxnDao).mockResolvedValue(undefined)
  vi.mocked(getCurrentParcelsByMemberDao).mockResolvedValue([])
  vi.mocked(getFormerParcelsByMemberDao).mockResolvedValue([])
  vi.mocked(getParcelOwnerAtDao).mockResolvedValue(undefined)
})

describe.each([
  ['[ORGANIZATION OWNER]', UserOrganizationRoleConst.OWNER],
  ['[ORGANIZATION ADMIN]', UserOrganizationRoleConst.ADMIN],
])('%s rattache des parcelles et enregistre des ventes', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
  })

  describe('attachParcelService (critères 1, 4, 5)', () => {
    it('should open a period on an existing parcel, checked after the lock, under the tenant scope', async () => {
      let writtenUnder: string | undefined
      vi.mocked(openPeriodTxnDao).mockImplementation(async () => {
        writtenUnder = scope.current
      })

      const result = await attachParcelService({
        organizationId: ORG_ID,
        memberProfileId: DUBOIS_ID,
        parcelNumber: ' 47 ',
        startsOn: '1998-02-03',
      })

      expect(findOrCreateParcelTxnDao).toHaveBeenCalledWith(ORG_ID, '47')
      expect(lockParcelTxnDao).toHaveBeenCalledWith(PARCEL_ID)
      expect(order(lockParcelTxnDao)).toBeLessThan(order(getParcelPeriodsDao))
      expect(order(getParcelPeriodsDao)).toBeLessThan(order(openPeriodTxnDao))
      expect(openPeriodTxnDao).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        parcelId: PARCEL_ID,
        memberProfileId: DUBOIS_ID,
        startsOn: '1998-02-03',
      })
      expect(writtenUnder).toBe(ORG_ID)
      expect(result).toEqual({
        status: 'attached',
        parcelId: PARCEL_ID,
        parcelNumber: '47',
        parcelCreated: false,
      })
    })

    it('should create an unknown parcel at attachment, and say so', async () => {
      vi.mocked(findOrCreateParcelTxnDao).mockResolvedValue({
        row: parcelRow({id: OTHER_PARCEL_ID, number: '112'}),
        created: true,
      })

      const result = await attachParcelService({
        organizationId: ORG_ID,
        memberProfileId: ROY_ID,
        parcelNumber: '112',
        startsOn: '2026-09-01',
      })

      expect(result).toEqual({
        status: 'attached',
        parcelId: OTHER_PARCEL_ID,
        parcelNumber: '112',
        parcelCreated: true,
      })
      expect(openPeriodTxnDao).toHaveBeenCalledWith(
        expect.objectContaining({parcelId: OTHER_PARCEL_ID})
      )
    })

    it('should refuse an overlap, naming the owner in place and their date, and open nothing (critère 4)', async () => {
      vi.mocked(getParcelPeriodsDao).mockResolvedValue(SOLD)

      const result = await attachParcelService({
        organizationId: ORG_ID,
        memberProfileId: BLANC_ID,
        parcelNumber: '47',
        startsOn: '2027-01-01',
      })

      expect(result).toEqual({
        status: 'overlap',
        parcelNumber: '47',
        conflict: {
          memberProfileId: ROY_ID,
          name: 'Hélène Roy',
          startsOn: '2026-06-15',
          endsOn: null,
        },
      })
      expect(openPeriodTxnDao).not.toHaveBeenCalled()
    })

    it('should attach two parcels to the same profile: one profile, two current parcels (critère 5)', async () => {
      vi.mocked(findOrCreateParcelTxnDao)
        .mockResolvedValueOnce({row: parcelRow({number: '5'}), created: true})
        .mockResolvedValueOnce({
          row: parcelRow({id: OTHER_PARCEL_ID, number: '6'}),
          created: true,
        })

      await attachParcelService({
        organizationId: ORG_ID,
        memberProfileId: DUBOIS_ID,
        parcelNumber: '5',
        startsOn: '2010-01-01',
      })
      await attachParcelService({
        organizationId: ORG_ID,
        memberProfileId: DUBOIS_ID,
        parcelNumber: '6',
        startsOn: '2012-01-01',
      })

      const opened = vi
        .mocked(openPeriodTxnDao)
        .mock.calls.map(([input]) => input)
      expect(opened.map((input) => input.memberProfileId)).toEqual([
        DUBOIS_ID,
        DUBOIS_ID,
      ])
      expect(opened.map((input) => input.parcelId)).toEqual([
        PARCEL_ID,
        OTHER_PARCEL_ID,
      ])
    })

    it('should answer member_not_found for an unknown profile, without creating a parcel', async () => {
      vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

      const result = await attachParcelService({
        organizationId: ORG_ID,
        memberProfileId: DUBOIS_ID,
        parcelNumber: '47',
        startsOn: '1998-02-03',
      })

      expect(result).toEqual({status: 'member_not_found'})
      for (const dao of writeDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    })

    it.each([
      ['a date that does not exist', {startsOn: '2026-02-30'}],
      ['a blank parcel number', {parcelNumber: '   '}],
    ])('should refuse %s and write nothing', async (_label, part) => {
      await expect(
        attachParcelService({
          organizationId: ORG_ID,
          memberProfileId: DUBOIS_ID,
          parcelNumber: '47',
          startsOn: '1998-02-03',
          ...part,
        })
      ).rejects.toThrow()

      for (const dao of writeDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    })
  })

  describe('recordSaleService (critères 2, 4)', () => {
    const sale = {
      organizationId: ORG_ID,
      parcelId: PARCEL_ID,
      sellerId: DUBOIS_ID,
      buyerId: ROY_ID,
      date: '2026-06-15',
    }

    beforeEach(() => {
      vi.mocked(getParcelPeriodsDao).mockResolvedValue(DUBOIS_OPEN)
    })

    it('should close the open period of the seller, then open the one of the buyer, after the lock', async () => {
      const result = await recordSaleService(sale)

      expect(result).toEqual({status: 'recorded'})
      expect(lockParcelTxnDao).toHaveBeenCalledWith(PARCEL_ID)
      expect(closeOpenPeriodTxnDao).toHaveBeenCalledTimes(1)
      expect(closeOpenPeriodTxnDao).toHaveBeenCalledWith(
        DUBOIS_PERIOD_ID,
        '2026-06-15'
      )
      expect(openPeriodTxnDao).toHaveBeenCalledTimes(1)
      expect(openPeriodTxnDao).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        parcelId: PARCEL_ID,
        memberProfileId: ROY_ID,
        startsOn: '2026-06-15',
      })
      expect(order(lockParcelTxnDao)).toBeLessThan(order(getParcelPeriodsDao))
      expect(order(getParcelPeriodsDao)).toBeLessThan(
        order(closeOpenPeriodTxnDao)
      )
      expect(order(closeOpenPeriodTxnDao)).toBeLessThan(order(openPeriodTxnDao))
    })

    it('should never target a closed period: a second sale closes the open one only', async () => {
      vi.mocked(getParcelPeriodsDao).mockResolvedValue(SOLD)

      await recordSaleService({
        ...sale,
        sellerId: ROY_ID,
        buyerId: BLANC_ID,
        date: '2030-03-01',
      })

      expect(closeOpenPeriodTxnDao).toHaveBeenCalledTimes(1)
      expect(closeOpenPeriodTxnDao).toHaveBeenCalledWith(
        ROY_PERIOD_ID,
        '2030-03-01'
      )
    })

    it.each([
      [
        'a date on the first day of the seller',
        {date: '1998-02-03'},
        {status: 'date_not_after_start', startsOn: '1998-02-03'},
      ],
      [
        'a date before the seller period',
        {date: '1990-01-01'},
        {status: 'date_not_after_start', startsOn: '1998-02-03'},
      ],
      [
        'a buyer who is the seller',
        {buyerId: DUBOIS_ID},
        {status: 'buyer_is_seller'},
      ],
      [
        'a seller without an open period on the parcel',
        {sellerId: BLANC_ID},
        {status: 'no_open_period'},
      ],
    ])('should refuse %s and write nothing', async (_label, part, expected) => {
      const result = await recordSaleService({...sale, ...part})

      expect(result).toEqual(expected)
      for (const dao of writeDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    })

    it('should refuse an overlap with a later period, naming its owner, and write nothing', async () => {
      vi.mocked(getParcelPeriodsDao).mockResolvedValue([
        ...DUBOIS_OPEN,
        periodRow(ROY_PERIOD_ID, BLANC_ID, '2030-01-01', '2035-01-01'),
      ])

      const result = await recordSaleService(sale)

      expect(result).toEqual({
        status: 'overlap',
        conflict: {
          memberProfileId: BLANC_ID,
          name: 'Marc Blanc',
          startsOn: '2030-01-01',
          endsOn: '2035-01-01',
        },
      })
      for (const dao of writeDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    })

    it('should answer not_found for an unknown parcel or an unknown buyer, and write nothing', async () => {
      vi.mocked(lockParcelTxnDao).mockResolvedValueOnce(undefined)
      expect(await recordSaleService(sale)).toEqual({status: 'not_found'})

      vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)
      expect(await recordSaleService(sale)).toEqual({status: 'not_found'})

      for (const dao of writeDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    })

    it('should fail as a whole when the period was closed meanwhile: the buyer period is never opened', async () => {
      vi.mocked(closeOpenPeriodTxnDao).mockResolvedValue(false)

      await expect(recordSaleService(sale)).rejects.toThrow()

      expect(openPeriodTxnDao).not.toHaveBeenCalled()
    })

    it('should let a failure while opening the buyer period escape the tenant scope, so that the closing is rolled back', async () => {
      vi.mocked(openPeriodTxnDao).mockRejectedValue(new Error('insert failed'))

      await expect(recordSaleService(sale)).rejects.toThrow('insert failed')
    })
  })

  describe('getParcelOwnerAtService (critère 3)', () => {
    it('should read the owner at the given date under the tenant scope', async () => {
      let readUnder: string | undefined
      vi.mocked(getParcelOwnerAtDao).mockImplementation(async () => {
        readUnder = scope.current
        return profileRow(DUBOIS_ID)
      })

      const owner = await getParcelOwnerAtService(
        ORG_ID,
        PARCEL_ID,
        '2026-06-14'
      )

      expect(getParcelOwnerAtDao).toHaveBeenCalledWith(PARCEL_ID, '2026-06-14')
      expect(readUnder).toBe(ORG_ID)
      expect(owner).toMatchObject({id: DUBOIS_ID, name: 'Jean et Odile Dubois'})
    })

    it('should return nothing when nobody owns the parcel at that date', async () => {
      expect(
        await getParcelOwnerAtService(ORG_ID, PARCEL_ID, '1990-01-01')
      ).toBeUndefined()
    })

    it('should refuse a date that does not exist', async () => {
      await expect(
        getParcelOwnerAtService(ORG_ID, PARCEL_ID, '2026-02-30')
      ).rejects.toThrow()
      expect(getParcelOwnerAtDao).not.toHaveBeenCalled()
    })
  })

  describe('getSaleContextService — écran de vente', () => {
    it('should give the parcel, the seller and every period of the parcel, under the tenant scope', async () => {
      let readUnder: string | undefined
      vi.mocked(getParcelPeriodsDao).mockImplementation(async () => {
        readUnder = scope.current
        return DUBOIS_OPEN
      })

      const context = await getSaleContextService(ORG_ID, DUBOIS_ID, PARCEL_ID)

      expect(context).toEqual({
        parcelId: PARCEL_ID,
        parcelNumber: '47',
        seller: {memberProfileId: DUBOIS_ID, name: 'Jean et Odile Dubois'},
        periods: [
          {
            id: DUBOIS_PERIOD_ID,
            memberProfileId: DUBOIS_ID,
            memberName: 'Jean et Odile Dubois',
            startsOn: '1998-02-03',
            endsOn: null,
          },
        ],
      })
      expect(readUnder).toBe(ORG_ID)
    })

    it('should give nothing when the profile no longer owns the parcel', async () => {
      vi.mocked(getParcelPeriodsDao).mockResolvedValue(SOLD)

      expect(
        await getSaleContextService(ORG_ID, DUBOIS_ID, PARCEL_ID)
      ).toBeUndefined()
    })

    it('should give nothing for an unknown parcel', async () => {
      vi.mocked(getParcelByIdDao).mockResolvedValue(undefined)

      expect(
        await getSaleContextService(ORG_ID, DUBOIS_ID, PARCEL_ID)
      ).toBeUndefined()
    })
  })

  describe('getMemberParcelsService (critère 5)', () => {
    it('should list the current and the former parcels of a profile, by parcel number', async () => {
      vi.mocked(getCurrentParcelsByMemberDao).mockResolvedValue([
        {parcelId: 'p30', number: '30', startsOn: '2015-05-01'},
        {parcelId: 'p5', number: '5', startsOn: '2010-01-01'},
        {parcelId: 'p6', number: '6', startsOn: '2012-01-01'},
      ])
      vi.mocked(getFormerParcelsByMemberDao).mockResolvedValue([
        {
          parcelId: PARCEL_ID,
          number: '47',
          startsOn: '1998-02-03',
          endsOn: '2026-06-15',
          buyerId: ROY_ID,
          buyerName: 'Hélène Roy',
        },
        {
          parcelId: OTHER_PARCEL_ID,
          number: '8',
          startsOn: '1990-01-01',
          endsOn: '1995-01-01',
          buyerId: null,
          buyerName: null,
        },
      ])

      const parcels = await getMemberParcelsService(ORG_ID, DUBOIS_ID)

      expect(parcels.current.map((parcel) => parcel.number)).toEqual([
        '5',
        '6',
        '30',
      ])
      expect(parcels.former).toEqual([
        {
          parcelId: OTHER_PARCEL_ID,
          number: '8',
          startsOn: '1990-01-01',
          endsOn: '1995-01-01',
          soldTo: null,
        },
        {
          parcelId: PARCEL_ID,
          number: '47',
          startsOn: '1998-02-03',
          endsOn: '2026-06-15',
          soldTo: {memberProfileId: ROY_ID, name: 'Hélène Roy'},
        },
      ])
      expect(getCurrentParcelsByMemberDao).toHaveBeenCalledWith(DUBOIS_ID)
    })
  })
})

const calls = {
  attachParcel: () =>
    attachParcelService({
      organizationId: ORG_ID,
      memberProfileId: DUBOIS_ID,
      parcelNumber: '47',
      startsOn: '1998-02-03',
    }),
  recordSale: () =>
    recordSaleService({
      organizationId: ORG_ID,
      parcelId: PARCEL_ID,
      sellerId: DUBOIS_ID,
      buyerId: ROY_ID,
      date: '2026-06-15',
    }),
  getParcelOwnerAt: () =>
    getParcelOwnerAtService(ORG_ID, PARCEL_ID, '2026-06-14'),
  getMemberParcels: () => getMemberParcelsService(ORG_ID, DUBOIS_ID),
  getSaleContext: () => getSaleContextService(ORG_ID, DUBOIS_ID, PARCEL_ID),
}

describe.each([
  ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
  [
    '[USER NOT IN ORGANIZATION]',
    withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
  ],
  ['[PUBLIC]', undefined],
])('%s ne touche à aucune parcelle', (_label, user) => {
  beforeEach(() => {
    setupAuthUserMocked(user)
  })

  it.each(Object.entries(calls))(
    'should refuse %s without calling any DAO',
    async (_name, call) => {
      await expect(call()).rejects.toThrow(AuthorizationError)

      for (const dao of allDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    }
  )
})
