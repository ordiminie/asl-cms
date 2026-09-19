'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {associationSettingsTag} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal, TENANT_CACHE_TAG} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {replaceAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'
import {updateAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {
  ASSOCIATION_IDENTITY_KINDS,
  AssociationIdentityKind,
  AssociationIdentityValidation,
  describeFileSize,
  DETECTED_FORMAT_LABELS,
  getIdentityVersionFromKey,
} from '@/services/types/domain/association-identity-types'
import {
  ACCENT_HUE_SETTING_KEY,
  AccentHue,
  getAccentHueName,
  isAccentHue,
} from '@/services/types/domain/association-settings-types'

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

export type AssociationAccentHueFormState = {
  success: boolean
  /** En cas de succes : la teinte enregistree. */
  accentHue?: AccentHue
  message?: string
}

/**
 * Enregistre la teinte d'accent de l'association du domaine appele (s02),
 * choisie dans la liste des six teintes validees. Meme contrat que les autres
 * actions du bureau : controle d'acces dans le service, erreurs rendues comme
 * resultat, invalidation de la lecture cachee des parametres au seul succes.
 */
export async function updateAssociationAccentHueAction(
  _prevState?: AssociationAccentHueFormState,
  formData?: FormData
): Promise<AssociationAccentHueFormState> {
  const t = await getTranslations('BureauIdentityPage')
  const tSettings = await getTranslations('AssociationSettings')
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.forbidden')}
    }
    throw error
  }

  const hue = formData?.get('accentHue')
  if (typeof hue !== 'string' || hue === '') {
    return {success: false, message: t('accentHue.errors.notSaved')}
  }

  try {
    const result = await updateAssociationSettingsService(tenant.id, {
      [ACCENT_HUE_SETTING_KEY]: hue,
    })
    const accentHue = Number(hue)
    if (result.status === 'rejected' || !isAccentHue(accentHue)) {
      return {success: false, message: t('accentHue.errors.notSaved')}
    }

    updateTag(associationSettingsTag(tenant.id))
    return {
      success: true,
      accentHue,
      message: t('accentHue.success', {
        name: tSettings(`hues.${getAccentHueName(accentHue)}`),
      }),
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.forbidden')}
    }
    return {success: false, message: t('accentHue.errors.notSaved')}
  }
}
