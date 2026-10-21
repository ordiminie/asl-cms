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
