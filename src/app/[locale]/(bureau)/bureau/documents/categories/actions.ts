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
  MEMBER_SPACE_ROUTE_PATTERN,
  SHARED_DOCUMENTS_ROUTE_PATTERN,
} from '@/components/features/shared-document/shared-document-paths'
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
 * Server Actions des categories de documents partages (s31), sur le patron
 * des sujets des questions (s23) : le domaine `document`.
 *
 * Un document n'envoie rien : l'adresse de routage n'est **jamais** ecrite,
 * quoi que porte l'envoi. Chacune rejoue le controle de session avant la
 * facade — le service reverifie `shared.document.manage` — puis revalide
 * apres le succes seulement.
 */

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const revalidateCategoryScreens = () => {
  revalidatePath(SHARED_DOCUMENTS_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_SPACE_ROUTE_PATTERN, 'page')
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
  const t = await getTranslations('BureauDocumentCategoriesPage')

  try {
    await requireActionAuth()

    const validation = createCategoryFormSchema(t).safeParse({
      ...Object.fromEntries(
        CATEGORY_FORM_FIELDS.map((field) => [field, readField(formData, field)])
      ),
      routingEmail: '',
    })
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

/** « Ajouter une categorie ». La 11ᵉ est refusee (ADR 028). */
export async function createDocumentCategoryAction(
  _prevState: CategoryActionResult | undefined,
  formData: FormData
): Promise<CategoryActionResult> {
  return saveCategory(formData, (values) =>
    createAssociationCategoryService({
      ...values,
      domain: CategoryDomainConst.DOCUMENT,
    })
  )
}

/** « Enregistrer la categorie » depuis le `dialog` de modification. */
export async function updateDocumentCategoryAction(
  _prevState: CategoryActionResult | undefined,
  formData: FormData
): Promise<CategoryActionResult> {
  return saveCategory(formData, (values) =>
    updateAssociationCategoryService({
      ...values,
      domain: CategoryDomainConst.DOCUMENT,
      categoryId: readField(formData, 'categoryId'),
    })
  )
}

/**
 * Supprime une categorie (logiquement) : elle n'est plus proposee au depot,
 * les documents deja ranges gardent son nom.
 */
export async function deleteDocumentCategoryAction(
  categoryId: string
): Promise<CategoryDeleteResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauDocumentCategoriesPage')

  try {
    await requireActionAuth()

    await deleteAssociationCategoryService({
      organizationId: tenant.id,
      domain: CategoryDomainConst.DOCUMENT,
      categoryId,
    })
    revalidateCategoryScreens()
    return {status: 'deleted'}
  } catch (error) {
    return toFailure(error, t)
  }
}
