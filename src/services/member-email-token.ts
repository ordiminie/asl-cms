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

/**
 * Ce qu'un email de confirmation **reporte** garde a la place du jeton et de
 * l'echeance (revue s54, M1) : le jeton en clair n'est jamais ecrit en base.
 * Au rejeu, un jeton neuf et son echeance, comptee de l'envoi reel, les
 * remplacent.
 */
export const CONFIRMATION_TOKEN_PLACEHOLDER = '__CONFIRMATION_TOKEN__'
export const CONFIRMATION_EXPIRY_PLACEHOLDER = '__CONFIRMATION_EXPIRY__'
