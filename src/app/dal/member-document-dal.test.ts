import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/member-document-service-facade', () => ({
  canManageMemberDocumentsService: vi.fn(),
  getMemberDocumentsOfProfileForBureauService: vi.fn(),
  getMemberDocumentsForBureauService: vi.fn(),
  getMemberDocumentBatchReachService: vi.fn(),
  getMyMemberDocumentsService: vi.fn(),
}))
vi.mock('@/services/facades/association-category-service-facade', () => ({
  listAssociationCategoriesService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {listAssociationCategoriesService} from '@/services/facades/association-category-service-facade'
import {
  canManageMemberDocumentsService,
  getMemberDocumentBatchReachService,
  getMemberDocumentsForBureauService,
  getMemberDocumentsOfProfileForBureauService,
  getMyMemberDocumentsService,
} from '@/services/facades/member-document-service-facade'

import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentBatchReachDal,
  getMemberDocumentCategoryChoicesDal,
  getMemberDocumentsForBureauDal,
  getMemberDocumentsOfProfileForBureauDal,
  getMyMemberDocumentsDal,
} from './member-document-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('member-document-dal — fiche du bureau (s32)', () => {
  it("dit si le compte gère les documents nominatifs de l'association du domaine", async () => {
    vi.mocked(canManageMemberDocumentsService).mockResolvedValue(true)

    expect(await canManageCurrentMemberDocumentsDal()).toBe(true)
    expect(canManageMemberDocumentsService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit les documents de la fiche pour un compte qui les gère', async () => {
    vi.mocked(canManageMemberDocumentsService).mockResolvedValue(true)
    vi.mocked(getMemberDocumentsOfProfileForBureauService).mockResolvedValue([])

    expect(
      await getMemberDocumentsOfProfileForBureauDal(ORG_A, PROFILE_ID)
    ).toEqual([])
    expect(getMemberDocumentsOfProfileForBureauService).toHaveBeenCalledWith(
      ORG_A,
      PROFILE_ID
    )
  })

  it("rien pour un compte qui ne les gère pas : la section n'est pas rendue", async () => {
    vi.mocked(canManageMemberDocumentsService).mockResolvedValue(false)

    expect(
      await getMemberDocumentsOfProfileForBureauDal(ORG_A, PROFILE_ID)
    ).toBeUndefined()
    expect(getMemberDocumentsOfProfileForBureauService).not.toHaveBeenCalled()
  })

  it('propose les catégories actives du domaine member_document, identifiant et nom seuls', async () => {
    vi.mocked(listAssociationCategoriesService).mockResolvedValue({
      items: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          organizationId: ORG_A,
          domain: 'member_document',
          name: 'Facture',
          routingEmail: null,
          createdAt: new Date(),
          usageCount: 3,
        },
      ],
      max: 10,
    })

    expect(await getMemberDocumentCategoryChoicesDal(ORG_A)).toEqual([
      {id: '44444444-4444-4444-8444-444444444444', name: 'Facture'},
    ])
    expect(listAssociationCategoriesService).toHaveBeenCalledWith(
      ORG_A,
      'member_document'
    )
  })
})

describe('member-document-dal — vue d’ensemble et lot (s32)', () => {
  it('lit une page filtrée de la vue d’ensemble', async () => {
    const page = {
      documents: [],
      total: 0,
      page: 2,
      pageSize: 25,
      countsByCategory: {},
      parcelNumbersByProfile: {},
    }
    vi.mocked(getMemberDocumentsForBureauService).mockResolvedValue(page)

    expect(
      await getMemberDocumentsForBureauDal(ORG_A, {
        search: 'Lef',
        categoryId: '',
        page: 2,
      })
    ).toBe(page)
    expect(getMemberDocumentsForBureauService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      search: 'Lef',
      categoryId: '',
      page: 2,
    })
  })

  it('lit les fiches atteignables par un lot', async () => {
    vi.mocked(getMemberDocumentBatchReachService).mockResolvedValue({
      profilesWithReference: 2,
      profilesWithoutReference: 1,
    })

    expect(await getMemberDocumentBatchReachDal(ORG_A)).toEqual({
      profilesWithReference: 2,
      profilesWithoutReference: 1,
    })
    expect(getMemberDocumentBatchReachService).toHaveBeenCalledWith(ORG_A)
  })
})

describe('member-document-dal — « Mes documents » (s32)', () => {
  it("lit les documents du compte sur l'association du domaine", async () => {
    vi.mocked(getMyMemberDocumentsService).mockResolvedValue([])

    expect(await getMyMemberDocumentsDal()).toEqual([])
    expect(getMyMemberDocumentsService).toHaveBeenCalledWith(ORG_A)
  })

  it('ne rend rien, sans casser l’espace, sans session', async () => {
    vi.mocked(getMyMemberDocumentsService).mockRejectedValue(
      new AuthorizationError()
    )

    expect(await getMyMemberDocumentsDal()).toBeUndefined()
  })

  it('laisse remonter une panne', async () => {
    vi.mocked(getMyMemberDocumentsService).mockRejectedValue(new Error('db'))

    await expect(getMyMemberDocumentsDal()).rejects.toThrow('db')
  })
})
