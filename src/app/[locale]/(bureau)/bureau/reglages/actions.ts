'use server'

import {revalidatePath, updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {
  associationSettingsTag,
  getAssociationSettingsDal,
} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {logger} from '@/lib/logger'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {updateAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {
  requestPennylaneSyncService,
  schedulePennylaneSyncService,
} from '@/services/facades/pennylane-sync-service-facade'
import {scheduleUnpaidRemindersService} from '@/services/facades/unpaid-reminder-service-facade'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingError,
  BILLING_PROVIDER_PENNYLANE,
  BILLING_PROVIDER_SETTING_KEY,
  BILLING_REMINDER_ENABLED_SETTING_KEY,
  getSettingsForPage,
  parseSettingValue,
  ResolvedAssociationSettings,
} from '@/services/types/domain/association-settings-types'
import type {PennylaneSyncActionState} from '@/services/types/domain/billing-sync-types'

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

/**
 * Un parametre de la carte « Referencement » change de valeur : le succes dit
 * alors que Google en tiendra compte (s11). Le formulaire renvoie aussi les
 * valeurs deja enregistrees ; elles ne comptent pas comme un changement.
 */
const changesSeoSetting = (
  changes: Record<string, string>,
  before: ResolvedAssociationSettings
): boolean =>
  getSettingsForPage(ASSOCIATION_SETTINGS_REGISTRY, 'settings').some(
    (definition) => {
      if (definition.section !== 'seo' || !(definition.key in changes)) {
        return false
      }
      const raw = changes[definition.key]
      const parsed = parseSettingValue(definition, raw)
      const next = parsed.valid ? parsed.normalized : raw.trim()
      return next !== (before[definition.key]?.storedValue ?? '')
    }
  )

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

const SETTINGS_PATH = '/bureau/reglages'

/**
 * Programme la synchronisation horaire apres le passage a Pennylane (s20,
 * ADR 062 §8). L'enregistrement a deja eu lieu : un echec ici ne le defait
 * pas, il est journalise ; « Mettre a jour maintenant » garantit aussi la
 * tache.
 */
const schedulePennylaneSync = async (organizationId: string): Promise<void> => {
  try {
    await schedulePennylaneSyncService(organizationId, new Date())
  } catch (error) {
    logger.error('[SETTINGS] Synchronisation Pennylane non programmee', {
      organizationId,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}

/**
 * La relance automatique **passe** a activee (s29) : le formulaire renvoie
 * aussi la valeur deja enregistree, qui n'est pas une activation.
 */
const enablesUnpaidReminders = (
  changes: Record<string, string>,
  before: ResolvedAssociationSettings
): boolean =>
  changes[BILLING_REMINDER_ENABLED_SETTING_KEY] === 'true' &&
  before[BILLING_REMINDER_ENABLED_SETTING_KEY]?.value !== true

/**
 * Garantit la tache quotidienne des relances apres leur activation (s29,
 * ADR 070 §4). L'enregistrement a deja eu lieu : un echec ici ne le defait
 * pas, il est journalise.
 */
const scheduleUnpaidReminders = async (
  organizationId: string
): Promise<void> => {
  try {
    await scheduleUnpaidRemindersService(organizationId, new Date())
  } catch (error) {
    logger.error('[SETTINGS] Relances des impayes non programmees', {
      organizationId,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}

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
    const changes = settingsPageChanges(formData)
    const before = await getAssociationSettingsDal(tenant.id)
    const result = await updateAssociationSettingsService(tenant.id, changes)

    if (result.status === 'rejected') {
      return {success: false, fieldErrors: result.errors}
    }

    updateTag(associationSettingsTag(tenant.id))
    if (changes[BILLING_PROVIDER_SETTING_KEY] === BILLING_PROVIDER_PENNYLANE) {
      await schedulePennylaneSync(tenant.id)
    }
    if (enablesUnpaidReminders(changes, before)) {
      await scheduleUnpaidReminders(tenant.id)
    }
    return {
      success: true,
      message: changesSeoSetting(changes, before)
        ? t('successSeo')
        : t('success'),
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.forbidden')}
    }
    return {success: false, message: t('errors.failed'), kept: t('errors.kept')}
  }
}

/**
 * « Mettre a jour maintenant » (s20, ADR 062 §8) : synchronise les factures
 * de l'association du domaine appele et garantit la tache horaire. Le
 * service exige `member.invoice.manage` ; toute erreur est rendue, jamais
 * levee. La page est rafraichie apres une tentative, reussie ou non.
 */
export async function requestPennylaneSyncAction(): Promise<PennylaneSyncActionState> {
  const t = await getTranslations('BureauSettingsPage')
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()
    const result = await requestPennylaneSyncService(tenant.id, new Date())
    if (result.status === 'skipped') {
      return {status: 'error', message: t('pennylaneSync.notPennylane')}
    }
    revalidatePath(SETTINGS_PATH)
    return result.status === 'synced'
      ? {status: 'synced', message: t('pennylaneSync.synced')}
      : {
          status: 'failed',
          message: t(`pennylaneSync.errors.${result.error}`),
        }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {status: 'error', message: t('errors.forbidden')}
    }
    return {status: 'error', message: t('pennylaneSync.errors.unavailable')}
  }
}
