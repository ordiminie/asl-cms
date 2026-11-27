import {z} from 'zod'

import {classifyLinkAddress} from '@/lib/helper/link-address'
import {
  MENU_LINK_ADDRESS_MAX_LENGTH,
  MENU_LINK_LABEL_MAX_LENGTH,
  type MenuLinkItemDTO,
} from '@/services/types/domain/site-navigation-types'

/**
 * Le `dialog` d'une entree libre du menu (s50, ecran A) : ajout et
 * modification. Partage par le client (React Hook Form) et par les Server
 * Actions, qui rejouent ce schema pour rendre les erreurs **par champ**. Le
 * service revalide de son cote : ce schema n'est pas la garde.
 */
type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

export const menuLinkFormSchema = z.object({
  label: z.string(),
  address: z.string(),
})

export type MenuLinkFormSchemaType = z.infer<typeof menuLinkFormSchema>

export const MENU_LINK_FORM_FIELDS = [
  'label',
  'address',
] as const satisfies readonly (keyof MenuLinkFormSchemaType)[]

export type MenuLinkFormField = (typeof MENU_LINK_FORM_FIELDS)[number]

/** Nombre de caracteres du libelle au-dela du plafond, zero en deca. */
export const menuLinkLabelExcess = (label: string): number =>
  Math.max(0, label.trim().length - MENU_LINK_LABEL_MAX_LENGTH)

const labelSchema = (t: Translate) =>
  z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (value.length === 0) {
        context.addIssue({
          code: 'custom',
          message: t('validation.labelRequired'),
        })
        return
      }
      const excess = menuLinkLabelExcess(value)
      if (excess > 0) {
        context.addIssue({
          code: 'custom',
          message: t('validation.labelTooLong', {count: excess}),
        })
      }
    })

/**
 * Le message dit ce qui est accepte, jamais la liste de ce qui est refuse ;
 * `http://` a le sien parce que c'est la faute la plus probable.
 */
const addressSchema = (t: Translate) =>
  z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (value.length > MENU_LINK_ADDRESS_MAX_LENGTH) {
        context.addIssue({
          code: 'custom',
          message: t('validation.addressTooLong', {
            max: MENU_LINK_ADDRESS_MAX_LENGTH,
          }),
        })
        return
      }
      const classified = classifyLinkAddress(value)
      if (classified.ok) return

      const messageKey = {
        empty: 'validation.addressRequired',
        http: 'validation.addressHttp',
        refused: 'validation.addressRefused',
      }[classified.reason]
      context.addIssue({code: 'custom', message: t(messageKey)})
    })

/** Le schema du formulaire d'une entree libre, messages traduits. */
export function createMenuLinkFormSchema(t: Translate) {
  return menuLinkFormSchema.extend({
    label: labelSchema(t),
    address: addressSchema(t),
  })
}

/** Resultat d'un ajout ou d'une modification, rendu par les Server Actions. */
export type MenuLinkActionResult =
  | {status: 'saved'; item: MenuLinkItemDTO}
  | {
      status: 'invalid'
      errors: {field: MenuLinkFormField; message: string}[]
    }
  | {status: 'error'; message: string}
