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
  /** Le compteur d'eau de la parcelle (s53), `null` s'il n'est pas renseigne. */
  meterNumber: string | null
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

/**
 * Un terrain = une fiche reliee au compte (s53, ADR 054) : ses parcelles
 * actuelles et anciennes. Aucun identifiant de fiche.
 */
export type MyLandDTO = {
  /** Le nom de la fiche, tel qu'il s'ecrit sur un courrier. */
  name: string
  current: MyCurrentParcelDTO[]
  former: MyFormerParcelDTO[]
}

/**
 * « Mes terrains » (s53) : le nom du compte et les fiches qui lui sont
 * reliees, dans l'ordre de l'ADR 054 §7.
 */
export type MyLandsDTO = {
  accountName: string
  lands: MyLandDTO[]
}

/** Telephone et adresse postale, tels que le membre les corrige (s16). */
export type MyPostalContactDTO = {
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

/**
 * Un jeu de coordonnees partage par une partie des terrains (s53, 2b), titre
 * par leurs parcelles et les noms des fiches.
 */
export type MyContactGroupDTO = MyPostalContactDTO & {
  parcelNumbers: string[]
  /** Les noms des fiches du groupe qui ne sont pas celui du compte. */
  names: string[]
}

/**
 * Les coordonnees de la personne (s16, s53) : celles du premier terrain, ni
 * identifiant, ni nom, ni compte. L'email est affiche, jamais modifiable par
 * le membre (ADR 040). Elles valent pour `landCount` terrains ; `divergent`
 * quand les fiches n'ont pas toutes les memes, avec un groupe par jeu.
 */
/** « Mes coordonnees » : sans email, les adresses ont leur carte (s54). */
export type MyContactDTO = MyPostalContactDTO & {
  landCount: number
  divergent: boolean
  groups: MyContactGroupDTO[]
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
