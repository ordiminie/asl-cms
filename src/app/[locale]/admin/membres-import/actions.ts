'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireActionAuth} from '@/app/dal/user-dal'
import type {
  MemberImportError,
  MemberImportFormState,
} from '@/components/features/admin/member-import/member-import-state'
import {MEMBER_PROFILES_ROUTE_PATTERN} from '@/components/features/member-profile/member-profile-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {importMembersService} from '@/services/facades/member-import-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'
import {
  ImportMembersResult,
  MEMBER_IMPORT_FILE_EXTENSION,
  MEMBER_IMPORT_MAX_FILE_BYTES,
} from '@/services/types/domain/member-import-types'

type Translate = Awaited<ReturnType<typeof getTranslations>>

type FileRefusal = Extract<ImportMembersResult, {status: 'file_refused'}>

const quoteColumns = (columns: string[]): string =>
  columns.map((column) => `« ${column} »`).join(', ')

const refusalDetail = (t: Translate, refusal: FileRefusal): string => {
  const key = `errors.unreadable.${refusal.reason}`
  if (refusal.reason === 'missing_columns') {
    const columns = refusal.missingColumns ?? []
    return t(key, {count: columns.length, columns: quoteColumns(columns)})
  }
  if (refusal.reason === 'too_many_lines') {
    return t(key, {max: refusal.maxLines ?? 0})
  }
  return t(key)
}

const failure = (
  error: MemberImportError,
  message: string,
  extra: Partial<MemberImportFormState> = {}
): MemberImportFormState => ({success: false, error, message, ...extra})

const isCsvName = (name: string): boolean =>
  name.toLowerCase().endsWith(MEMBER_IMPORT_FILE_EXTENSION)

const toState = (
  t: Translate,
  result: ImportMembersResult,
  file: File,
  organizationId: string
): MemberImportFormState => {
  if (result.status === 'organization_not_found') {
    return failure('organization_missing', t('errors.nothingImported'), {
      title: t('errors.organizationMissingTitle'),
      nextStep: t('errors.chooseAnotherOrganization'),
    })
  }
  if (result.status === 'file_refused') {
    return failure('file_unreadable', t('errors.nothingImported'), {
      title: t('errors.unreadableTitle'),
      detail: refusalDetail(t, result),
      nextStep: t('errors.chooseAnotherFile'),
    })
  }
  return {
    success: true,
    report: result.report,
    fileName: file.name,
    organizationId,
    importedAt: new Date().toISOString(),
  }
}

/**
 * Importe la liste des proprietaires d'une association (s13) : SuperAdmin
 * seul. La garde est rejouee ici, puis par le service. Toute erreur est rendue
 * comme un resultat, jamais levee vers l'ecran.
 */
export async function importMembersAction(
  _prevState?: MemberImportFormState,
  formData?: FormData
): Promise<MemberImportFormState> {
  const t = await getTranslations('AdminMemberImport')

  try {
    await requireActionAuth({roles: [RoleConst.SUPER_ADMIN]})
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return failure('forbidden', t('errors.forbidden'))
    }
    throw error
  }

  const organizationId = formData?.get('organizationId')
  const file = formData?.get('file')
  if (
    typeof organizationId !== 'string' ||
    organizationId === '' ||
    !(file instanceof File) ||
    file.name === ''
  ) {
    return failure('invalid_data', t('errors.invalidData'))
  }
  if (!isCsvName(file.name)) {
    return failure('file_type', t('errors.fileType'))
  }
  if (file.size > MEMBER_IMPORT_MAX_FILE_BYTES) {
    return failure('file_too_large', t('errors.fileTooLarge'))
  }

  try {
    const result = await importMembersService({
      organizationId,
      content: new Uint8Array(await file.arrayBuffer()),
    })
    if (result.status === 'imported') {
      revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')
    }
    return toState(t, result, file, organizationId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return failure('forbidden', t('errors.forbidden'))
    }
    return failure('failed', t('errors.failed'))
  }
}
