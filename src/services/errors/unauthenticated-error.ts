/**
 * Aucune session : la ressource exige un utilisateur authentifie (s31,
 * ADR 069). Distincte d'`AuthorizationError` — une route la rend 401, pas
 * 403.
 */
export class UnauthenticatedError extends Error {
  constructor(message: string = 'Authentification requise.') {
    super(message)
    this.name = 'UnauthenticatedError'
  }
}
