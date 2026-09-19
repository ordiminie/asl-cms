'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {associationSettingsTag} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {updateAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingError,
  getSettingsForPage,
} from '@/services/types/domain/association-settings-types'

export type AssociationSettingsFormState = {
  success: boolean
  /** Message de l'alerte en tete : succes, refus d'acces ou panne. */
  message?: string
  /** En cas de panne : ce qui reste en vigueur. */
  kept?: string
  /**
   * Refus par parametre, sous forme de codes : le formulaire les traduit avec
   * les memes regles que sa propre validation au _blur_.
   */
  fieldErrors?: Record<string, AssociationSettingError>
}

/** Les seules cles recues : celles que la page « Reglages » affiche. */
const settingsPageChanges = (formData: FormData): Record<string, string> =>
  Object.fromEntries(
    getSettingsForPage(ASSOCIATION_SETTINGS_REGISTRY, 'settings')
      .filter((definition) => formData.has(definition.key))
      .map((definition) => [
        definition.key,
        String(formData.get(definition.key)),
      ])
  )

/**
 * Modifie les reglages de l'association du domaine appele (s02).
 *
 * Le controle d'acces est porte par le service (bureau de cette association ou
 * SuperAdmin) ; la session est exigee ici en premier. Toute erreur est rendue
 * comme un resultat, jamais levee vers l'interface. Apres succes seulement, la
 * lecture cachee de cette association est invalidee.
 */
export async function updateAssociationSettingsAction(
  _prevState?: AssociationSettingsFormState,
  formData?: FormData
): Promise<AssociationSettingsFormState> {
  const t = await getTranslations('BureauSettingsPage')
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.forbidden')}
    }
    throw error
  }

  if (!formData) {
    return {success: false, message: t('errors.invalidData')}
  }

  try {
    const result = await updateAssociationSettingsService(
      tenant.id,
      settingsPageChanges(formData)
    )

    if (result.status === 'rejected') {
      return {success: false, fieldErrors: result.errors}
    }

    updateTag(associationSettingsTag(tenant.id))
    return {success: true, message: t('success')}
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.forbidden')}
    }
    return {success: false, message: t('errors.failed'), kept: t('errors.kept')}
  }
}
