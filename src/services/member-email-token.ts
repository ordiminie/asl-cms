import 'server-only'

import {createHash, randomBytes} from 'node:crypto'

/**
 * Jeton du lien de confirmation d'une adresse (s54, ADR 056 §5) : 32 octets
 * aleatoires en base64url, envoyes **une fois** dans l'email ; la base n'en
 * garde que le SHA-256. Usage unique : le hash est efface a la confirmation.
 */
const CONFIRMATION_TOKEN_BYTES = 32
const CONFIRMATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export const newConfirmationToken = (): string =>
  randomBytes(CONFIRMATION_TOKEN_BYTES).toString('base64url')

export const hashConfirmationToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

/** Une chaine qui a la forme d'un jeton ; rien n'est lu en base sinon. */
export const isConfirmationTokenShaped = (token: string): boolean =>
  CONFIRMATION_TOKEN_PATTERN.test(token)
