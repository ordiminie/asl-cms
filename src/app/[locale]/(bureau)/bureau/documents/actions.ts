'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {SharedDocumentFormState} from '@/components/features/shared-document/shared-document-form-validation'
import {
  MEMBER_SPACE_ROUTE_PATTERN,
  SHARED_DOCUMENTS_PATH,
  SHARED_DOCUMENTS_ROUTE_PATTERN,
  SharedDocumentNoticeParamConst,
} from '@/components/features/shared-document/shared-document-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  deleteSharedDocumentService,
  publishSharedDocumentService,
} from '@/services/facades/shared-document-service-facade'

/**
 * Server Actions de l'ecran « Documents » du bureau (s31, ADR 069) : deposer
 * et retirer un document partage.
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant la facade
 * — le service reverifie `shared.document.manage` — puis revalide le
 * back-office et l'espace membre **apres** le succes seulement. Un refus est
 * rendu comme un resultat, jamais leve. Le retour a la liste se fait par
 * `redirect()` **hors du `try`** : il leve `NEXT_REDIRECT`, qu'un `catch`
 * avalerait.
 */

const failure = async (
  error: unknown,
  failedKey: 'failed' | 'deleteFailed' = 'failed'
): Promise<SharedDocumentFormState> => {
  const t = await getTranslations('BureauSharedDocumentsPage')
  return {
    status: 'error',
    message:
      error instanceof AuthorizationError
        ? t('errors.forbidden')
        : t(`errors.${failedKey}`),
  }
}

const textOf = (formData: FormData, key: string): string => {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

/** Un champ de fichier laisse vide arrive comme un fichier sans octet. */
const fileOf = (formData: FormData, key: string): File | undefined => {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : undefined
}

const revalidateDocumentScreens = () => {
  revalidatePath(SHARED_DOCUMENTS_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_SPACE_ROUTE_PATTERN, 'page')
}

/** Depose un document : le titre, la categorie et le PDF du meme envoi. */
export async function publishSharedDocumentAction(
  _state: SharedDocumentFormState,
  formData: FormData
): Promise<SharedDocumentFormState> {
  const tenant = await requireCurrentTenantDal()
  let documentId: string

  try {
    await requireActionAuth()

    const result = await publishSharedDocumentService({
      organizationId: tenant.id,
      title: textOf(formData, 'title'),
      categoryId: textOf(formData, 'categoryId'),
      file: fileOf(formData, 'file'),
    })
    if (result.status === 'rejected') return result

    documentId = result.document.id
    revalidateDocumentScreens()
  } catch (error) {
    return failure(error)
  }

  redirect(
    `${SHARED_DOCUMENTS_PATH}?statut=${SharedDocumentNoticeParamConst.PUBLISHED}&document=${documentId}`
  )
}

/**
 * Retire un document : il disparait de l'espace des membres et son adresse
 * cesse de servir le fichier (critere 5). Irreversible.
 */
export async function deleteSharedDocumentAction(
  documentId: string
): Promise<SharedDocumentFormState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await deleteSharedDocumentService({organizationId: tenant.id, documentId})

    revalidateDocumentScreens()
  } catch (error) {
    return failure(error, 'deleteFailed')
  }

  redirect(
    `${SHARED_DOCUMENTS_PATH}?statut=${SharedDocumentNoticeParamConst.DELETED}`
  )
}
