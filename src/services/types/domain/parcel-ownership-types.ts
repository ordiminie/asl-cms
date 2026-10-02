/**
 * Types de domaine de la propriete datee des parcelles (s12, ADR 029). Ecrits
 * **sans importer le modele Drizzle** (`rule-architecture`).
 *
 * Toutes les dates sont des chaines ISO `YYYY-MM-DD`, sans heure ni fuseau :
 * elles se comparent telles quelles. Une periode est **demi-ouverte**
 * `[startsOn, endsOn)` : `endsOn` est le jour de la vente, premier jour de
 * l'acquereur ; `null` tant que la periode est ouverte.
 */

export const PARCEL_NUMBER_MAX_LENGTH = 30

export type OwnershipPeriod = {
  id: string
  memberProfileId: string
  startsOn: string
  endsOn: string | null
}

export type NamedOwnershipPeriod = OwnershipPeriod & {memberName: string}

/** Une periode candidate, avant ecriture. */
export type OwnershipPeriodCandidate = {
  startsOn: string
  endsOn: string | null
}

export const SaleRefusalConst = {
  DATE_NOT_AFTER_START: 'date_not_after_start',
  BUYER_IS_SELLER: 'buyer_is_seller',
  NO_OPEN_PERIOD: 'no_open_period',
  OVERLAP: 'overlap',
} as const

export type SaleRefusal =
  (typeof SaleRefusalConst)[keyof typeof SaleRefusalConst]

export type SalePlanInput = {
  periods: OwnershipPeriod[]
  sellerId: string
  buyerId: string
  date: string
}

/**
 * Ce qu'une vente ecrit : **une** cloture, sur la periode ouverte du vendeur,
 * et **une** ouverture, pour l'acquereur. Ou un refus type, qui n'ecrit rien.
 */
export type SalePlan =
  | {
      ok: true
      close: {periodId: string; endsOn: string}
      open: {memberProfileId: string; startsOn: string}
    }
  | {ok: false; reason: SaleRefusal; conflict?: OwnershipPeriod}

/** Une parcelle possedee aujourd'hui par la fiche. */
export type CurrentParcelDTO = {
  parcelId: string
  number: string
  startsOn: string
}

/** Une parcelle que la fiche a possedee : periode close, immuable. */
export type FormerParcelDTO = {
  parcelId: string
  number: string
  startsOn: string
  /** Jour de la vente : le dernier jour de propriete est la veille. */
  endsOn: string
  /** L'acquereur, s'il est connu. */
  soldTo: {memberProfileId: string; name: string} | null
}

export type MemberParcelsDTO = {
  current: CurrentParcelDTO[]
  former: FormerParcelDTO[]
}

export type ParcelOwnerDTO = {
  memberProfileId: string
  name: string
}

/** Le proprietaire en place qui fait refuser un rattachement ou une vente. */
export type OwnershipConflictDTO = {
  memberProfileId: string
  name: string
  startsOn: string
  endsOn: string | null
}

export type AttachParcelInput = {
  organizationId: string
  memberProfileId: string
  parcelNumber: string
  startsOn: string
}

export type AttachParcelResult =
  | {
      status: 'attached'
      parcelId: string
      parcelNumber: string
      /** La parcelle n'existait pas : elle vient d'etre creee (design `4d`). */
      parcelCreated: boolean
    }
  | {status: 'overlap'; parcelNumber: string; conflict: OwnershipConflictDTO}
  | {status: 'member_not_found'}
  /** La date de debut est posterieure a aujourd'hui : rien n'est ecrit. */
  | {status: 'future_date'}

export type RecordSaleInput = {
  organizationId: string
  parcelId: string
  sellerId: string
  buyerId: string
  date: string
}

export type RecordSaleResult =
  | {status: 'recorded'}
  | {status: 'date_not_after_start'; startsOn: string}
  | {status: 'buyer_is_seller'}
  | {status: 'no_open_period'}
  | {status: 'overlap'; conflict: OwnershipConflictDTO | null}
  | {status: 'not_found'}
  /** La date de la vente est posterieure a aujourd'hui : rien n'est ecrit. */
  | {status: 'future_date'}

/** Le contexte de l'ecran de vente : la parcelle et la periode du vendeur. */
export type SaleContextDTO = {
  parcelId: string
  parcelNumber: string
  seller: ParcelOwnerDTO
  /**
   * Toutes les periodes de la parcelle, chacune avec le nom de sa fiche : de
   * quoi rejouer `planSale` a l'ecran et nommer un proprietaire en conflit.
   */
  periods: NamedOwnershipPeriod[]
}
