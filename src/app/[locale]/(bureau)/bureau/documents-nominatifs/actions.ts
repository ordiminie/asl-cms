'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {
  MemberDocumentBatchLineActionResult,
  MemberDocumentFormState,
} from '@/components/features/member-documents/member-document-form-validation'
import {
  MEMBER_DOCUMENTS_PATH,
  MEMBER_DOCUMENTS_ROUTE_PATTERN,
  MEMBER_PROFILE_ROUTE_PATTERN,
  MEMBER_SPACE_ROUTE_PATTERN,
  MemberDocumentNoticeParamConst,
  type MemberDocumentRemovalOrigin,
} from '@/components/features/member-documents/member-document-paths'
import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  depositMemberDocumentBatchLineService,
  depositMemberDocumentService,
  removeMemberDocumentService,
} from '@/services/facades/member-document-service-facade'

/**
 * Server Actions des documents nominatifs du bureau (s32, ADR 073) : deposer
 * pour une fiche, deposer une ligne d'un lot et retirer.
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant la facade
 * — le service reverifie `member.document.manage` — puis revalide la fiche,
 * la vue d'ensemble et l'espace membre **apres** le succes seulement. Un
 * refus est rendu comme un resultat, jamais leve. Le retour se fait par
 * `redirect()` **hors du `try`** : il leve `NEXT_REDIRECT`, qu'un `catch`
 * avalerait.
 */

const failure = async (
  error: unknown,
  failedKey: 'failed' | 'removeFailed' = 'failed'
): Promise<MemberDocumentFormState> => {
  const t = await getTranslations('BureauMemberDocuments')
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

const revalidateMemberDocumentScreens = () => {
  revalidatePath(MEMBER_PROFILE_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_DOCUMENTS_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_SPACE_ROUTE_PATTERN, 'page')
}

/** Depose un document pour une fiche : titre, categorie, date et PDF. */
export async function depositMemberDocumentAction(
  _state: MemberDocumentFormState,
  formData: FormData
): Promise<MemberDocumentFormState> {
  const tenant = await requireCurrentTenantDal()
  let memberProfileId: string
  let documentId: string

  try {
    await requireActionAuth()

    const result = await depositMemberDocumentService({
      organizationId: tenant.id,
      memberProfileId: textOf(formData, 'memberProfileId'),
      title: textOf(formData, 'title'),
      categoryId: textOf(formData, 'categoryId'),
      documentDate: textOf(formData, 'documentDate'),
      file: fileOf(formData, 'file'),
    })
    if (result.status === 'rejected') return result

    memberProfileId = result.document.memberProfileId
    documentId = result.document.id
    revalidateMemberDocumentScreens()
  } catch (error) {
    return failure(error)
  }

  redirect(
    `${memberProfilePathOf(memberProfileId)}?documents=${MemberDocumentNoticeParamConst.DEPOSITED}&document=${documentId}`
  )
}

/**
 * Retire un document : il disparait de l'espace des comptes relies a sa
 * fiche et son adresse cesse de servir le fichier. Irreversible. Le retour
 * se fait la ou le retrait a ete demande.
 */
export async function removeMemberDocumentAction(
  documentId: string,
  origin: MemberDocumentRemovalOrigin
): Promise<MemberDocumentFormState> {
  const tenant = await requireCurrentTenantDal()
  let memberProfileId: string

  try {
    await requireActionAuth()

    const removed = await removeMemberDocumentService({
      organizationId: tenant.id,
      documentId,
    })
    memberProfileId = removed.memberProfileId
    revalidateMemberDocumentScreens()
  } catch (error) {
    return failure(error, 'removeFailed')
  }

  redirect(
    origin === 'profile'
      ? `${memberProfilePathOf(memberProfileId)}?documents=${MemberDocumentNoticeParamConst.REMOVED}`
      : `${MEMBER_DOCUMENTS_PATH}?statut=${MemberDocumentNoticeParamConst.REMOVED}`
  )
}

/**
 * Une ligne d'un depot en lot (critere 7, ADR 073 §8) : **un fichier par
 * appel**, sous le plafond de 16 Mo d'une requete. Le serveur seul rapproche
 * le fichier de sa fiche ; un echec n'arrete pas le lot, il est rendu pour
 * cette ligne.
 */
export async function depositMemberDocumentBatchLineAction(
  formData: FormData
): Promise<MemberDocumentBatchLineActionResult> {
  const tenant = await requireCurrentTenantDal()
  const file = fileOf(formData, 'file')
  const fileName = file?.name ?? ''

  try {
    await requireActionAuth()

    const result = await depositMemberDocumentBatchLineService({
      organizationId: tenant.id,
      fileName,
      title: textOf(formData, 'title'),
      categoryId: textOf(formData, 'categoryId'),
      documentDate: textOf(formData, 'documentDate'),
      file,
    })
    if (result.status === 'deposited') revalidateMemberDocumentScreens()
    return result
  } catch (error) {
    const t = await getTranslations('BureauMemberDocuments')
    return {
      status: 'error',
      fileName,
      message:
        error instanceof AuthorizationError
          ? t('errors.forbidden')
          : t('errors.batchFailed'),
    }
  }
}
