import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `BureauQuestionCategoriesPage.${key}`)
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
import {getTranslations} from 'next-intl/server'

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
  createQuestionCategoryAction,
  deleteQuestionCategoryAction,
  updateQuestionCategoryAction,
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
  domain: 'question' as const,
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

describe('createQuestionCategoryAction (s23)', () => {
  it('crée le sujet dans le domaine question, puis revalide le bureau et le formulaire du membre', async () => {
    const result = await createQuestionCategoryAction(
      undefined,
      categoryForm({name: 'Voirie', routingEmail: 'voirie@x.test'})
    )

    expect(result).toEqual({status: 'saved', name: 'Voirie'})
    expect(createAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'question',
      name: 'Voirie',
      routingEmail: 'voirie@x.test',
    })
    expect(getTranslations).toHaveBeenCalledWith('BureauQuestionCategoriesPage')
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/questions',
      'layout'
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(app)/dashboard/question',
      'page'
    )
  })

  it('rejette un nom vide sans appeler la façade', async () => {
    const result = await createQuestionCategoryAction(
      undefined,
      categoryForm({name: '  ', routingEmail: ''})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'name',
          message: 'BureauQuestionCategoriesPage.validation.nameRequired',
        },
      ],
    })
    expect(createAssociationCategoryService).not.toHaveBeenCalled()
  })

  it('rend le plafond atteint au 11ᵉ sujet (critère 3)', async () => {
    vi.mocked(createAssociationCategoryService).mockRejectedValue(
      new CategoryLimitReachedError(10)
    )

    const result = await createQuestionCategoryAction(
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

    await expect(
      createQuestionCategoryAction(
        undefined,
        categoryForm({name: 'Voirie', routingEmail: ''})
      )
    ).resolves.toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'name',
          message: 'BureauQuestionCategoriesPage.validation.duplicate',
        },
      ],
    })
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      createQuestionCategoryAction(
        undefined,
        categoryForm({name: 'Voirie', routingEmail: ''})
      )
    ).resolves.toEqual({
      status: 'error',
      message: 'BureauQuestionCategoriesPage.errors.forbidden',
    })
    expect(createAssociationCategoryService).not.toHaveBeenCalled()
  })
})

describe('updateQuestionCategoryAction (s23)', () => {
  it('modifie le sujet désigné, dans le domaine question', async () => {
    await updateQuestionCategoryAction(
      undefined,
      categoryForm({categoryId: CATEGORY_ID, name: 'Voirie', routingEmail: ''})
    )

    expect(updateAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'question',
      categoryId: CATEGORY_ID,
      name: 'Voirie',
      routingEmail: '',
    })
  })
})

describe('deleteQuestionCategoryAction (s23)', () => {
  it('supprime le sujet dans le domaine question, puis revalide', async () => {
    const result = await deleteQuestionCategoryAction(CATEGORY_ID)

    expect(result).toEqual({status: 'deleted'})
    expect(deleteAssociationCategoryService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      domain: 'question',
      categoryId: CATEGORY_ID,
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(app)/dashboard/question',
      'page'
    )
  })

  it('refuse sans session, sans supprimer', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(deleteQuestionCategoryAction(CATEGORY_ID)).resolves.toEqual({
      status: 'error',
      message: 'BureauQuestionCategoriesPage.errors.forbidden',
    })
    expect(deleteAssociationCategoryService).not.toHaveBeenCalled()
  })
})
