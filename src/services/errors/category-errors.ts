/**
 * Refus metier des categories (s10, ADR 028). Des erreurs dediees plutot
 * qu'une `ValidationError` : l'action les traduit chacune en un message que le
 * bureau comprend, ancre au bon endroit de l'ecran.
 */

/** La 11ᵉ categorie d'un domaine est refusee (critere 4). */
export class CategoryLimitReachedError extends Error {
  readonly max: number

  constructor(max: number) {
    super(`Plafond de ${max} categories atteint`)
    this.name = 'CategoryLimitReachedError'
    this.max = max
  }
}

/** Une categorie active du meme domaine porte deja ce nom, sans tenir compte de la casse. */
export class DuplicateCategoryNameError extends Error {
  constructor() {
    super('Une categorie active porte deja ce nom')
    this.name = 'DuplicateCategoryNameError'
  }
}
