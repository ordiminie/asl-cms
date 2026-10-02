import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/member-profile-service-facade', () => ({
  canManageMemberProfilesService: vi.fn(),
  getMemberProfilePageService: vi.fn(),
  getMemberProfileService: vi.fn(),
}))
vi.mock('@/services/facades/parcel-ownership-service-facade', () => ({
  getMemberParcelsService: vi.fn(),
  getSaleContextService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageMemberProfilesService,
  getMemberProfilePageService,
  getMemberProfileService,
} from '@/services/facades/member-profile-service-facade'
import {
  getMemberParcelsService,
  getSaleContextService,
} from '@/services/facades/parcel-ownership-service-facade'

import {
  canManageCurrentMemberProfilesDal,
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
  getMemberProfilesPageForBureauDal,
  getSaleContextForBureauDal,
} from './member-profile-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('member-profile-dal — liste', () => {
  it('rend la page de la liste telle que le service la donne, recherche comprise', async () => {
    const list = {
      items: [],
      page: 2,
      pageSize: 25,
      total: 26,
      totalPages: 2,
      profileCount: 412,
      incompleteCount: 1,
    }
    vi.mocked(getMemberProfilePageService).mockResolvedValue(list)

    await expect(
      getMemberProfilesPageForBureauDal(ORG_A, 2, 'dub')
    ).resolves.toBe(list)
    expect(getMemberProfilePageService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      page: 2,
      search: 'dub',
    })
  })

  it('demande au service si l’utilisateur gère les fiches du domaine appelé', async () => {
    vi.mocked(canManageMemberProfilesService).mockResolvedValue(true)

    await expect(canManageCurrentMemberProfilesDal()).resolves.toBe(true)
    expect(canManageMemberProfilesService).toHaveBeenCalledWith(ORG_A)
  })
})

describe('member-profile-dal — fiche', () => {
  it('rend la fiche telle que le service la donne', async () => {
    const profile = {id: PROFILE_ID, name: 'Hélène Roy'}
    vi.mocked(getMemberProfileService).mockResolvedValue(profile as never)

    await expect(getMemberProfileForBureauDal(ORG_A, PROFILE_ID)).resolves.toBe(
      profile
    )
    expect(getMemberProfileService).toHaveBeenCalledWith(ORG_A, PROFILE_ID)
  })

  it('traduit un identifiant malformé en undefined, que la page rend en 404', async () => {
    vi.mocked(getMemberProfileService).mockRejectedValue(
      new ValidationParsedZodError()
    )

    await expect(
      getMemberProfileForBureauDal(ORG_A, 'pas-un-uuid')
    ).resolves.toBeUndefined()
  })

  it('laisse remonter un refus', async () => {
    vi.mocked(getMemberProfileService).mockRejectedValue(
      new AuthorizationError()
    )

    await expect(
      getMemberProfileForBureauDal(ORG_A, `${PROFILE_ID}-refus`)
    ).rejects.toThrow(AuthorizationError)
  })

  it('rend les parcelles actuelles et anciennes de la fiche', async () => {
    const parcels = {current: [], former: []}
    vi.mocked(getMemberParcelsService).mockResolvedValue(parcels)

    await expect(getMemberParcelsForBureauDal(ORG_A, PROFILE_ID)).resolves.toBe(
      parcels
    )
    expect(getMemberParcelsService).toHaveBeenCalledWith(ORG_A, PROFILE_ID)
  })
})

describe('member-profile-dal — vente', () => {
  const PARCEL_ID = '66666666-6666-4666-8666-666666666666'

  it('rend le contexte de la vente tel que le service le donne', async () => {
    const context = {parcelId: PARCEL_ID, parcelNumber: '47'}
    vi.mocked(getSaleContextService).mockResolvedValue(context as never)

    await expect(
      getSaleContextForBureauDal(ORG_A, PROFILE_ID, PARCEL_ID)
    ).resolves.toBe(context)
    expect(getSaleContextService).toHaveBeenCalledWith(
      ORG_A,
      PROFILE_ID,
      PARCEL_ID
    )
  })

  it('traduit un identifiant malformé en undefined, que la page rend en 404', async () => {
    vi.mocked(getSaleContextService).mockRejectedValue(
      new ValidationParsedZodError()
    )

    await expect(
      getSaleContextForBureauDal(ORG_A, PROFILE_ID, 'pas-un-uuid')
    ).resolves.toBeUndefined()
  })
})
