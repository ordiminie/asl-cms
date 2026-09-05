export const GRANTED_ERROR_MESSAGE = 'Accès refusé'

export class AuthorizationError extends Error {
  constructor(message: string = 'Accès non autorisé.') {
    super(message)
    this.name = 'AuthorizationError'
    this.message = message ?? GRANTED_ERROR_MESSAGE
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, AuthorizationError)
    }
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Ressource introuvable.') {
    super(message)
    this.name = 'NotFoundError'
  }
}
