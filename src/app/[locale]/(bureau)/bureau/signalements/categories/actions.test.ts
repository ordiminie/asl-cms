import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `BureauReportCategoriesPage.${key}`)
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
import {
  CategoryLimitReachedError,
  DuplicateCategoryNameError,
} from '@/services/errors/category-errors'
import {
  createAssociationCategoryService,
  deleteAssociationCategoryService,
  updateAssociationCategoryService,
} from '@/services/facades/association-category-service-facade'

import {
  createReportCategoryAction,
  deleteReportCategoryAction,
  updateReportCategoryAction,
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
  domain: 'report' as const,
  name: 'Voirie',
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

describe('createReportCategoryAction', () => {
  it('crée la catégorie de signalement de l’association, puis revalide écran, file et formulaire public', async () => {
    const result = await createReportCategoryAction(
      undefined,
      categoryForm({name: ' Voirie ', routingEmail: ''})
    )

    expect(result).toEqual({status: 'saved', name: 'Voirie'})
    expect(createAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'report',
      name: ' Voirie ',
      routingEmail: '',
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/signalements',
      'layout'
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(public)/signaler',
      'page'
    )
  })

  it('rejette un nom vide et une adresse mal formée sans appeler la façade', async () => {
    const result = await createReportCategoryAction(
      undefined,
      categoryForm({name: '  ', routingEmail: 'voirie@'})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'name',
          message: 'BureauReportCategoriesPage.validation.nameRequired',
        },
        {
          field: 'routingEmail',
          message: 'BureauReportCategoriesPage.validation.emailInvalid',
        },
      ],
    })
    expect(createAssociationCategoryService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend le plafond atteint (critère 4)', async () => {
    vi.mocked(createAssociationCategoryService).mockRejectedValue(
      new CategoryLimitReachedError(10)
    )

    const result = await createReportCategoryAction(
      undefined,
      categoryForm({name: 'Onzième', routingEmail: ''})
    )

    expect(result).toEqual({status: 'limit_reached', max: 10})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend le doublon de nom sous le champ nom', async () => {
    vi.mocked(createAssociationCategoryService).mockRejectedValue(
      new DuplicateCategoryNameError()
    )

    const result = await createReportCategoryAction(
      undefined,
      categoryForm({name: 'Nuisance', routingEmail: ''})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'name',
          message: 'BureauReportCategoriesPage.validation.duplicate',
        },
      ],
    })
  })

  it('refuse sans session, sans appeler la façade ni revalider', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await createReportCategoryAction(
      undefined,
      categoryForm({name: 'Voirie', routingEmail: ''})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauReportCategoriesPage.errors.forbidden',
    })
    expect(createAssociationCategoryService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('updateReportCategoryAction', () => {
  it('modifie la catégorie désignée', async () => {
    const result = await updateReportCategoryAction(
      undefined,
      categoryForm({
        categoryId: CATEGORY_ID,
        name: 'Voirie',
        routingEmail: 'voirie@x.test',
      })
    )

    expect(result).toEqual({status: 'saved', name: 'Voirie'})
    expect(updateAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'report',
      categoryId: CATEGORY_ID,
      name: 'Voirie',
      routingEmail: 'voirie@x.test',
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('refuse sans rôle au bureau, sans revalider', async () => {
    vi.mocked(updateAssociationCategoryService).mockRejectedValue(
      new AuthorizationError()
    )

    const result = await updateReportCategoryAction(
      undefined,
      categoryForm({categoryId: CATEGORY_ID, name: 'Voirie', routingEmail: ''})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauReportCategoriesPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('deleteReportCategoryAction', () => {
  it('supprime la catégorie, puis revalide', async () => {
    const result = await deleteReportCategoryAction(CATEGORY_ID)

    expect(result).toEqual({status: 'deleted'})
    expect(deleteAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'report',
      categoryId: CATEGORY_ID,
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(public)/signaler',
      'page'
    )
  })

  it('refuse sans session, sans supprimer ni revalider', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await deleteReportCategoryAction(CATEGORY_ID)

    expect(result).toEqual({
      status: 'error',
      message: 'BureauReportCategoriesPage.errors.forbidden',
    })
    expect(deleteAssociationCategoryService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
