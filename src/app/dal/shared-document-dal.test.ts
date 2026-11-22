import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/shared-document-service-facade', () => ({
  canManageSharedDocumentsService: vi.fn(),
  getSharedDocumentsForBureauService: vi.fn(),
  getSharedDocumentsForMemberService: vi.fn(),
}))
vi.mock('@/services/facades/association-category-service-facade', () => ({
  listAssociationCategoriesService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {listAssociationCategoriesService} from '@/services/facades/association-category-service-facade'
import {
  canManageSharedDocumentsService,
  getSharedDocumentsForBureauService,
  getSharedDocumentsForMemberService,
} from '@/services/facades/shared-document-service-facade'

import {
  canManageCurrentSharedDocumentsDal,
  getDocumentCategoriesForBureauDal,
  getDocumentCategoryChoicesDal,
  getMySharedDocumentsDal,
  getSharedDocumentsForBureauDal,
} from './shared-document-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'

const categoryList = {
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      organizationId: ORG_A,
      domain: 'document' as const,
      name: 'Statuts',
      routingEmail: null,
      createdAt: new Date(),
      usageCount: 2,
    },
  ],
  max: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
  vi.mocked(listAssociationCategoriesService).mockResolvedValue(categoryList)
})

describe('shared-document-dal — bureau (s31)', () => {
  it('dit si le compte gère les documents de l’association du domaine', async () => {
    vi.mocked(canManageSharedDocumentsService).mockResolvedValue(true)

    expect(await canManageCurrentSharedDocumentsDal()).toBe(true)
    expect(canManageSharedDocumentsService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit la liste du bureau par la façade', async () => {
    vi.mocked(getSharedDocumentsForBureauService).mockResolvedValue([])

    expect(await getSharedDocumentsForBureauDal(ORG_A)).toEqual([])
    expect(getSharedDocumentsForBureauService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit les catégories du domaine document pour l’écran des catégories', async () => {
    expect(await getDocumentCategoriesForBureauDal(ORG_A)).toEqual(categoryList)
    expect(listAssociationCategoriesService).toHaveBeenCalledWith(
      ORG_A,
      'document'
    )
  })

  it('ne donne au formulaire de dépôt que l’identifiant et le nom des catégories actives', async () => {
    expect(await getDocumentCategoryChoicesDal(ORG_A)).toEqual([
      {id: '44444444-4444-4444-8444-444444444444', name: 'Statuts'},
    ])
  })
})

describe('shared-document-dal — espace membre (s31, critère 2)', () => {
  it('lit les documents de l’association du domaine, avec son seul identifiant', async () => {
    const documents = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Statuts',
        categoryName: 'Statuts',
        fileBytes: 1,
        createdAt: new Date(),
      },
    ]
    vi.mocked(getSharedDocumentsForMemberService).mockResolvedValue(documents)

    expect(await getMySharedDocumentsDal()).toEqual(documents)
    expect(getSharedDocumentsForMemberService).toHaveBeenCalledWith(ORG_A)
  })

  it('ne rend rien, sans casser l’espace, pour un compte sans droit de lecture', async () => {
    vi.mocked(getSharedDocumentsForMemberService).mockRejectedValue(
      new AuthorizationError()
    )

    expect(await getMySharedDocumentsDal()).toBeUndefined()
  })

  it('laisse remonter une panne', async () => {
    vi.mocked(getSharedDocumentsForMemberService).mockRejectedValue(
      new Error('db')
    )

    await expect(getMySharedDocumentsDal()).rejects.toThrow('db')
  })
})
