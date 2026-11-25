import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve(
      (key: string) => `BureauMemberDocumentCategoriesPage.${key}`
    )
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/association-category-service-facade', () => ({
  createAssociationCategoryService: vi.fn(),
  deleteAssociationCategoryService: vi.fn(),
  updateAssociationCategoryService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {CategoryLimitReachedError} from '@/services/errors/category-errors'
import {
  createAssociationCategoryService,
  deleteAssociationCategoryService,
  updateAssociationCategoryService,
} from '@/services/facades/association-category-service-facade'

import {
  createMemberDocumentCategoryAction,
  deleteMemberDocumentCategoryAction,
  updateMemberDocumentCategoryAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333'

const categoryForm = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const savedCategory = {
  id: CATEGORY_ID,
  organizationId: TENANT_ID,
  domain: 'member_document' as const,
  name: 'Facture',
  routingEmail: null,
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  vi.mocked(createAssociationCategoryService).mockResolvedValue(savedCategory)
  vi.mocked(updateAssociationCategoryService).mockResolvedValue(savedCategory)
  vi.mocked(deleteAssociationCategoryService).mockResolvedValue()
})

describe('createMemberDocumentCategoryAction (s32)', () => {
  it('crée la catégorie dans le domaine member_document, sans adresse de routage, puis revalide', async () => {
    const result = await createMemberDocumentCategoryAction(
      undefined,
      categoryForm({name: 'Facture', routingEmail: 'glisse@x.test'})
    )

    expect(result).toEqual({status: 'saved', name: 'Facture'})
    expect(createAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'member_document',
      name: 'Facture',
      routingEmail: '',
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/documents-nominatifs',
      'layout'
    )
  })

  it('rejette un nom vide sans appeler la façade', async () => {
    const result = await createMemberDocumentCategoryAction(
      undefined,
      categoryForm({name: ''})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'name',
          message: 'BureauMemberDocumentCategoriesPage.validation.nameRequired',
        },
      ],
    })
    expect(createAssociationCategoryService).not.toHaveBeenCalled()
  })

  it('rend le plafond atteint à la 11ᵉ catégorie', async () => {
    vi.mocked(createAssociationCategoryService).mockRejectedValue(
      new CategoryLimitReachedError(10)
    )

    const result = await createMemberDocumentCategoryAction(
      undefined,
      categoryForm({name: 'Onzième'})
    )

    expect(result).toEqual({status: 'limit_reached', max: 10})
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await createMemberDocumentCategoryAction(
      undefined,
      categoryForm({name: 'Facture'})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberDocumentCategoriesPage.errors.forbidden',
    })
    expect(createAssociationCategoryService).not.toHaveBeenCalled()
  })
})

describe('updateMemberDocumentCategoryAction (s32)', () => {
  it('renomme la catégorie désignée, dans le domaine member_document', async () => {
    await updateMemberDocumentCategoryAction(
      undefined,
      categoryForm({categoryId: CATEGORY_ID, name: 'Facture'})
    )

    expect(updateAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'member_document',
      categoryId: CATEGORY_ID,
      name: 'Facture',
      routingEmail: '',
    })
  })
})

describe('deleteMemberDocumentCategoryAction (s32)', () => {
  it('supprime la catégorie dans le domaine member_document, puis revalide', async () => {
    const result = await deleteMemberDocumentCategoryAction(CATEGORY_ID)

    expect(result).toEqual({status: 'deleted'})
    expect(deleteAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'member_document',
      categoryId: CATEGORY_ID,
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('refuse sans session, sans supprimer', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await deleteMemberDocumentCategoryAction(CATEGORY_ID)

    expect(deleteAssociationCategoryService).not.toHaveBeenCalled()
  })
})
