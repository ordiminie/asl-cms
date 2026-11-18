/**
 * Refus metier des campagnes (s27, ADR 060 §3). Une erreur dediee : l'action
 * la traduit en un message ancre dans le composeur, et rien ne part.
 */

/**
 * La cible n'a pas pu etre calculee : les factures du fournisseur actif n'ont
 * pas pu etre lues. Jamais de repli sur « tous » ni sur « vide ».
 */
export class CampaignTargetUnavailableError extends Error {
  constructor(options?: {cause?: unknown}) {
    super('La cible de la campagne n’a pas pu être calculée', options)
    this.name = 'CampaignTargetUnavailableError'
  }
}
