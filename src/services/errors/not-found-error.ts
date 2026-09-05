/**
 * Erreur lancée quand une ressource n'est pas trouvée
 */
export class NotFoundError extends Error {
  constructor(message: string = 'Ressource non trouvée') {
    super(message)
    this.name = 'NotFoundError'
  }
}
