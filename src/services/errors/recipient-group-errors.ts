/**
 * Refus metier des groupes de destinataires (s27, ADR 060 §4). Une erreur
 * dediee plutot qu'une `ValidationError` : l'action la traduit en un message
 * ancre sous le champ du nom.
 */

/** Un groupe de l'association porte deja ce nom, sans tenir compte de la casse. */
export class DuplicateRecipientGroupNameError extends Error {
  constructor() {
    super('Un groupe porte deja ce nom')
    this.name = 'DuplicateRecipientGroupNameError'
  }
}
