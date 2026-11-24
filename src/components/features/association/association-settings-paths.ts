import type {AssociationSettingSection} from '@/services/types/domain/association-settings-types'

/** La page « Reglages » du bureau (s02). */
export const SETTINGS_PATH = '/bureau/reglages'

/**
 * L'ancre de la carte d'une section des reglages : la page des relances
 * (s29) mene a la sienne. Module sans `'use client'` : le formulaire et les
 * pages serveur le lisent tous deux.
 */
export const settingsSectionAnchorOf = (
  section: AssociationSettingSection
): string => `reglages-${section}`

/** Le chemin de la carte d'une section des reglages. */
export const settingsSectionPathOf = (
  section: AssociationSettingSection
): string => `${SETTINGS_PATH}#${settingsSectionAnchorOf(section)}`
