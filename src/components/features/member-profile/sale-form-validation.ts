import {z} from 'zod'

import {frenchDateToIso} from '@/components/ui/date-field-format'
import type {OwnershipConflictDTO} from '@/services/types/domain/parcel-ownership-types'

/**
 * Formulaire de vente (s12, ecran 5). Partage par le client et par l'action
 * serveur. La date est saisie `jj/mm/aaaa` ; l'acquereur est une fiche
 * existante, choisie dans la recherche.
 */
type Translate = (key: string) => string

export const saleFormSchema = z.object({
  date: z.string(),
  buyerId: z.string(),
})

export function createSaleFormSchema(t: Translate) {
  return saleFormSchema.extend({
    date: z.string().refine((value) => frenchDateToIso(value) !== undefined, {
      message: t('validation.dateInvalid'),
    }),
    buyerId: z.string().refine((value) => value.trim().length > 0, {
      message: t('validation.buyerRequired'),
    }),
  })
}

export type SaleFormSchemaType = z.infer<typeof saleFormSchema>

export const SALE_FORM_FIELDS = [
  'date',
  'buyerId',
] as const satisfies readonly (keyof SaleFormSchemaType)[]

export type SaleFormField = (typeof SALE_FORM_FIELDS)[number]

/** Resultat d'une vente, rendu par la Server Action. Un refus n'ecrit rien. */
export type RecordSaleActionResult =
  | {status: 'recorded'}
  | {status: 'invalid'; errors: {field: SaleFormField; message: string}[]}
  | {status: 'date_not_after_start'; startsOn: string}
  | {status: 'buyer_is_seller'}
  | {status: 'no_open_period'}
  | {status: 'overlap'; conflict: OwnershipConflictDTO | null}
  /** La date est posterieure a aujourd'hui : rien n'a ete ecrit. */
  | {status: 'future_date'}
  | {status: 'error'; message: string}

/** Une fiche proposee comme acquereur, ses parcelles actuelles en `meta`. */
export type BuyerOption = {
  id: string
  name: string
  currentParcelNumbers: string[]
}
