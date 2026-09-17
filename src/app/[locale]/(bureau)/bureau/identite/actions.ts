'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal, TENANT_CACHE_TAG} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {replaceAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'
import {
  ASSOCIATION_IDENTITY_KINDS,
  AssociationIdentityKind,
  AssociationIdentityValidation,
  describeFileSize,
  DETECTED_FORMAT_LABELS,
  getIdentityVersionFromKey,
} from '@/services/types/domain/association-identity-types'

export type AssociationIdentityFormState = {
  success: boolean
  kind?: AssociationIdentityKind
  /** En cas d'erreur : le titre de l'alerte. */
  title?: string
  /** Ce qui s'est passe (succes ou erreur). */
  message?: string
  /** En cas d'erreur : ce qui est conserve. */
  kept?: string
  /** En cas d'erreur : l'action suivante. */
  nextStep?: string
  /** En cas de succes : la version du nouveau fichier, pour l'apercu. */
  version?: string
}

type Translate = Awaited<ReturnType<typeof getTranslations>>

type RejectedValidation = Exclude<AssociationIdentityValidation, {valid: true}>

const formatSize = (t: Translate, bytes: number): string => {
  const {unit, value} = describeFileSize(bytes)
  return t(`sizes.${unit}`, {value})
}

const isIdentityKind = (value: unknown): value is AssociationIdentityKind =>
  (ASSOCIATION_IDENTITY_KINDS as readonly unknown[]).includes(value)

const rejectionReason = (t: Translate, validation: RejectedValidation) => {
  if (validation.reason === 'size') {
    return t('errors.tooLarge', {
      size: formatSize(t, validation.size),
      limit: formatSize(t, validation.maxBytes),
    })
  }
  return validation.detectedFormat
    ? t('errors.formatRefused', {
        format: DETECTED_FORMAT_LABELS[validation.detectedFormat],
      })
    : t('errors.formatUnknown')
}

const notSavedState = (
  t: Translate,
  kind: AssociationIdentityKind,
  hasCurrentFile: boolean,
  reason: string
): AssociationIdentityFormState => ({
  success: false,
  kind,
  title: t('errors.notSaved'),
  message: reason,
  kept: hasCurrentFile
    ? t(`errors.kept.${kind}`)
    : t(`errors.keptDefault.${kind}`),
  nextStep: t(`errors.chooseFormat.${kind}`),
})

/**
 * Remplace le logo ou le favicon de l'association du domaine appele (s01b).
 *
 * Le controle d'acces est porte par le service (bureau de cette association ou
 * SuperAdmin) ; la session est exigee ici en premier. Toute erreur est rendue
 * comme un resultat, jamais levee vers l'interface. Apres succes, le tag du
 * tenant est invalide : la cle du fichier voyage avec la resolution du domaine.
 */
export async function replaceAssociationIdentityFileAction(
  _prevState?: AssociationIdentityFormState,
  formData?: FormData
): Promise<AssociationIdentityFormState> {
  const t = await getTranslations('BureauIdentityPage')
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.forbidden')}
    }
    throw error
  }

  const kind = formData?.get('kind')
  const file = formData?.get('file')
  if (!isIdentityKind(kind) || !(file instanceof File) || file.size === 0) {
    return {success: false, message: t('errors.invalidData')}
  }

  const hasCurrentFile = Boolean(
    kind === 'logo' ? tenant.logoKey : tenant.faviconKey
  )

  try {
    const result = await replaceAssociationIdentityFileService(
      tenant.id,
      kind,
      file
    )

    if (result.status === 'rejected') {
      return notSavedState(
        t,
        kind,
        hasCurrentFile,
        rejectionReason(t, result.validation)
      )
    }

    updateTag(TENANT_CACHE_TAG)
    return {
      success: true,
      kind,
      message: t(`success.${kind}`),
      version: getIdentityVersionFromKey(result.key),
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, kind, message: t('errors.forbidden')}
    }
    return notSavedState(t, kind, hasCurrentFile, t('errors.failed'))
  }
}
