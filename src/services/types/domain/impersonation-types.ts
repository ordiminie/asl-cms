import type {User} from './user-types'

/** Le SuperAdmin qui agit pendant une session a la place d'un compte (s48). */
export type Impersonator = {id: string; name: string}

/**
 * Qui agit : le compte vu (celui que l'autorisation juge) et, pendant une
 * session a la place d'un compte, le SuperAdmin qui agit (ADR 041).
 */
export type ActingContext = {user: User; impersonator?: Impersonator}

/**
 * Colonnes d'auteur d'une trace : l'auteur effectif et, pendant l'imitation,
 * le compte pour lequel il a agi. Nulles hors imitation.
 */
export type TraceAuthor = {
  authorUserId: string
  authorName: string
  onBehalfOfUserId: string | null
  onBehalfOfName: string | null
}

/**
 * L'auteur effectif d'une trace (ADR 041, decision 3) : le SuperAdmin s'il
 * agit a la place du compte vu, sinon le compte vu lui-meme.
 */
export const effectiveAuthor = (
  viewer: {id: string; name: string},
  impersonator?: Impersonator
): TraceAuthor =>
  impersonator
    ? {
        authorUserId: impersonator.id,
        authorName: impersonator.name,
        onBehalfOfUserId: viewer.id,
        onBehalfOfName: viewer.name,
      }
    : {
        authorUserId: viewer.id,
        authorName: viewer.name,
        onBehalfOfUserId: null,
        onBehalfOfName: null,
      }

/** Ouvrir une session a la place d'un compte d'une association (s48). */
export type OpenImpersonationInput = {
  organizationId: string
  userId: string
  /** Motif facultatif, garde dans la trace d'ouverture (200 caracteres). */
  reason?: string
}

/** Les refus d'ouverture, chacun avec son message a l'ecran. */
export type OpenImpersonationRefusal =
  | 'forbidden'
  | 'wrong_domain'
  | 'target_not_found'
  | 'target_is_admin'
  | 'suspended'
  | 'already_impersonating'

export type OpenImpersonationResult =
  {status: 'opened'; url: string} | {status: OpenImpersonationRefusal}

export type StopImpersonationResult =
  {status: 'closed'; url: string} | {status: 'not_impersonating'}

/** Longueur maximale du motif saisi a l'ouverture (D11). */
export const IMPERSONATION_REASON_MAX_LENGTH = 200

/** Ce que la banniere montre pendant une session a la place d'un compte. */
export type ImpersonationBarDTO = {
  subjectName: string
  /** Role du compte vu dans l'association du domaine. */
  role: 'member' | 'board' | 'owner'
  organizationName: string
  /** Fin de la session, lue sur `session.expiresAt` (ADR 042), en ISO. */
  expiresAt: string
}
