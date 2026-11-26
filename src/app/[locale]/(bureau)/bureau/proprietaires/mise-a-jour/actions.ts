'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {
  MemberAnnualImportError,
  MemberAnnualImportFormState,
} from '@/components/features/member-profile/annual-import/annual-import-state'
import {MEMBER_PROFILES_ROUTE_PATTERN} from '@/components/features/member-profile/member-profile-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {importAnnualMemberContactsService} from '@/services/facades/member-annual-import-service-facade'
import type {ImportAnnualMemberContactsResult} from '@/services/types/domain/member-annual-import-types'
import {
  MEMBER_IMPORT_FILE_EXTENSION,
  MEMBER_IMPORT_MAX_FILE_BYTES,
} from '@/services/types/domain/member-import-types'

type Translate = Awaited<ReturnType<typeof getTranslations>>

type FileRefusal = Extract<
  ImportAnnualMemberContactsResult,
  {status: 'file_refused'}
>

const quoteColumns = (columns: string[]): string =>
  columns.map((column) => `« ${column} »`).join(', ')

/** La cause du refus, dans les phrases du lecteur de s13. */
const refusalDetail = (tReader: Translate, refusal: FileRefusal): string => {
  const key = `errors.unreadable.${refusal.reason}`
  if (refusal.reason === 'missing_columns') {
    const columns = refusal.missingColumns ?? []
    return tReader(key, {count: columns.length, columns: quoteColumns(columns)})
  }
  if (refusal.reason === 'too_many_lines') {
    return tReader(key, {max: refusal.maxLines ?? 0})
  }
  return tReader(key)
}

const failure = (
  error: MemberAnnualImportError,
  message: string,
  extra: Partial<MemberAnnualImportFormState> = {}
): MemberAnnualImportFormState => ({success: false, error, message, ...extra})

const isCsvName = (name: string): boolean =>
  name.toLowerCase().endsWith(MEMBER_IMPORT_FILE_EXTENSION)

/**
 * Met a jour les coordonnees des fiches depuis le fichier de l'annee (s56) :
 * l'association est **celle du domaine appele**, jamais lue du formulaire
 * (ADR 003). La session est rejouee ici, la presidence par le service. Toute
 * erreur est rendue comme un resultat, jamais levee vers l'ecran.
 */
export async function importAnnualMemberContactsAction(
  _prevState?: MemberAnnualImportFormState,
  formData?: FormData
): Promise<MemberAnnualImportFormState> {
  const t = await getTranslations('BureauMemberAnnualImport')
  const tReader = await getTranslations('AdminMemberImport')

  try {
    await requireActionAuth()
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return failure('forbidden', t('errors.forbidden'))
    }
    throw error
  }

  const file = formData?.get('file')
  if (!(file instanceof File) || file.name === '') {
    return failure('invalid_data', t('errors.invalidData'))
  }
  if (!isCsvName(file.name)) {
    return failure('file_type', t('errors.fileType'))
  }
  if (file.size > MEMBER_IMPORT_MAX_FILE_BYTES) {
    return failure('file_too_large', t('errors.fileTooLarge'))
  }

  const tenant = await requireCurrentTenantDal()
  try {
    const result = await importAnnualMemberContactsService({
      organizationId: tenant.id,
      content: new Uint8Array(await file.arrayBuffer()),
    })
    if (result.status === 'file_refused') {
      return failure('file_unreadable', t('errors.nothingUpdated'), {
        title: t('errors.unreadableTitle'),
        detail: refusalDetail(tReader, result),
        nextStep: t('errors.chooseAnotherFile'),
      })
    }
    revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')
    return {
      success: true,
      report: result.report,
      fileName: file.name,
      importedAt: new Date().toISOString(),
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return failure('forbidden', t('errors.forbidden'))
    }
    revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')
    return failure('failed', t('errors.failed'), {
      title: t('errors.failedTitle'),
    })
  }
}
