import {z} from 'zod'

import {
  ASSOCIATION_SETTING_ERROR_CODES,
  AssociationSettingDefinition,
  AssociationSettingError,
  AssociationSettingErrorCode,
  validateSettingsChanges,
} from '@/services/types/domain/association-settings-types'

/** Valeurs du formulaire, indexees par nom de champ (`toSettingFieldName`). */
export type AssociationSettingsFormValues = Record<string, string>

/**
 * Nom de champ react-hook-form d'une cle du registre. Une cle contient des
 * points, que react-hook-form lit comme un chemin imbrique : ils sont encodes,
 * comme `[`, `]` et `%`, de facon reversible et sans collision.
 */
export const toSettingFieldName = (key: string): string =>
  encodeURIComponent(key).replaceAll('.', '%2E')

export const toSettingKey = (fieldName: string): string =>
  decodeURIComponent(fieldName)

/** Les valeurs du formulaire, reindexees par cle du registre. */
export const toSettingsChanges = (
  values: AssociationSettingsFormValues
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [toSettingKey(name), value])
  )

/**
 * Schema du formulaire des reglages. Ses regles sont celles du registre
 * (`validateSettingsChanges`), les memes que celles du service : chaque refus
 * porte le **code** du registre en message, traduit a l'affichage par les
 * cles de la definition (`errorMessageKeys`, sinon `errors.<code>`).
 */
export const createAssociationSettingsFormSchema = (
  definitions: readonly AssociationSettingDefinition[]
) =>
  z
    .object(
      Object.fromEntries(
        definitions.map((definition) => [
          toSettingFieldName(definition.key),
          z.string(),
        ])
      )
    )
    .superRefine((values, ctx) => {
      const validation = validateSettingsChanges(
        definitions,
        toSettingsChanges(values)
      )
      if (validation.valid) return
      for (const [key, error] of Object.entries(validation.errors)) {
        ctx.addIssue({
          code: 'custom',
          path: [toSettingFieldName(key)],
          message: error.code,
        })
      }
    })

const isErrorCode = (value: unknown): value is AssociationSettingErrorCode =>
  ASSOCIATION_SETTING_ERROR_CODES.some((code) => code === value)

/** Le refus d'un champ, bornes comprises, a partir du code porte en message. */
export const toSettingError = (
  definition: AssociationSettingDefinition,
  code: unknown
): AssociationSettingError | undefined => {
  if (!isErrorCode(code)) return undefined
  if (definition.type !== 'number') return {code}
  return {code, min: definition.min, max: definition.max}
}
