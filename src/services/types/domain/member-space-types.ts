/**
 * Types de domaine de l'espace membre (s12d, ecran C). Ecrits sans importer
 * le modele Drizzle (`rule-architecture`).
 *
 * Ce que voit un proprietaire de **sa** fiche : aucun identifiant de fiche,
 * et jamais l'acquereur d'une parcelle vendue (donnee d'un autre membre).
 */

/** Une parcelle actuelle : periode ouverte, date ISO `YYYY-MM-DD`. */
export type MyCurrentParcelDTO = {
  number: string
  startsOn: string
}

/**
 * Une ancienne parcelle : `endsOn` est le jour de la vente, premier jour de
 * l'acquereur ; le dernier jour du proprietaire est la veille.
 */
export type MyFormerParcelDTO = {
  number: string
  startsOn: string
  endsOn: string
}

export type MyParcelsDTO = {
  /** Le nom de la fiche, tel qu'il s'ecrit sur un courrier. */
  name: string
  current: MyCurrentParcelDTO[]
  former: MyFormerParcelDTO[]
}

/**
 * Les coordonnees de « ma fiche » (s16) : ni identifiant, ni nom, ni compte.
 * L'email est affiche, jamais modifiable par le membre (ADR 040).
 */
export type MyContactDTO = {
  email: string | null
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

/** Coordonnees saisies par le membre : jamais d'email (ADR 040). */
export type UpdateMyContactInput = {
  organizationId: string
  phone?: string | null
  addressLine?: string | null
  addressComplement?: string | null
  postalCode?: string | null
  city?: string | null
}

export type UpdateMyContactResult =
  {status: 'saved'; contact: MyContactDTO} | {status: 'not_found'}
