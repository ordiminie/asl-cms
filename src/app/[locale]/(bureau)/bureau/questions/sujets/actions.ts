'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  CATEGORY_FORM_FIELDS,
  type CategoryActionResult,
  type CategoryDeleteResult,
  type CategoryFormField,
  createCategoryFormSchema,
} from '@/components/features/incident-report/category-form-validation'
import {
  MEMBER_QUESTION_FORM_ROUTE_PATTERN,
  MEMBER_QUESTIONS_ROUTE_PATTERN,
} from '@/components/features/member-question/member-question-paths'
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
import {CategoryDomainConst} from '@/services/types/domain/association-category-types'

/**
 * Server Actions des sujets des questions des membres (s23, ecran D), sur le
 * patron des categories de signalement (s10) : le domaine `question`.
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie `question.manage` — puis revalide l'ecran,
 * la file et le formulaire du membre **apres** le succes seulement. Plafond et
 * doublon sont rendus comme des resultats, jamais leves.
 */

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const revalidateCategoryScreens = () => {
  revalidatePath(MEMBER_QUESTIONS_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_QUESTION_FORM_ROUTE_PATTERN, 'page')
}

type Translator = Awaited<ReturnType<typeof getTranslations>>

const toFailure = (
  error: unknown,
  t: Translator
): CategoryActionResult & CategoryDeleteResult => ({
  status: 'error',
  message:
    error instanceof AuthorizationError
      ? t('errors.forbidden')
      : t('errors.failed'),
})

const saveCategory = async (
  formData: FormData,
  save: (values: {
    organizationId: string
    name: string
    routingEmail: string
  }) => Promise<{name: string}>
): Promise<CategoryActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauQuestionCategoriesPage')

  try {
    await requireActionAuth()

    const validation = createCategoryFormSchema(t).safeParse(
      Object.fromEntries(
        CATEGORY_FORM_FIELDS.map((field) => [field, readField(formData, field)])
      )
    )
    if (!validation.success) {
      return {
        status: 'invalid',
        errors: validation.error.issues.map((issue) => ({
          field: issue.path[0] as CategoryFormField,
          message: issue.message,
        })),
      }
    }

    const saved = await save({organizationId: tenant.id, ...validation.data})
    revalidateCategoryScreens()
    return {status: 'saved', name: saved.name}
  } catch (error) {
    if (error instanceof CategoryLimitReachedError) {
      return {status: 'limit_reached', max: error.max}
    }
    if (error instanceof DuplicateCategoryNameError) {
      return {
        status: 'invalid',
        errors: [{field: 'name', message: t('validation.duplicate')}],
      }
    }
    return toFailure(error, t)
  }
}

/** « Ajouter un sujet ». Le 11ᵉ est refuse (critere 3). */
export async function createQuestionCategoryAction(
  _prevState: CategoryActionResult | undefined,
  formData: FormData
): Promise<CategoryActionResult> {
  return saveCategory(formData, (values) =>
    createAssociationCategoryService({
      ...values,
      domain: CategoryDomainConst.QUESTION,
    })
  )
}

/** « Enregistrer le sujet » depuis le `dialog` de modification. */
export async function updateQuestionCategoryAction(
  _prevState: CategoryActionResult | undefined,
  formData: FormData
): Promise<CategoryActionResult> {
  return saveCategory(formData, (values) =>
    updateAssociationCategoryService({
      ...values,
      domain: CategoryDomainConst.QUESTION,
      categoryId: readField(formData, 'categoryId'),
    })
  )
}

/**
 * Supprime un sujet (logiquement, critere 5) : il n'est plus propose, les
 * questions recues sont conservees.
 */
export async function deleteQuestionCategoryAction(
  categoryId: string
): Promise<CategoryDeleteResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauQuestionCategoriesPage')

  try {
    await requireActionAuth()

    await deleteAssociationCategoryService({
      organizationId: tenant.id,
      domain: CategoryDomainConst.QUESTION,
      categoryId,
    })
    revalidateCategoryScreens()
    return {status: 'deleted'}
  } catch (error) {
    return toFailure(error, t)
  }
}
