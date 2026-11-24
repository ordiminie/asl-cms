import type {BetterAuthPlugin} from 'better-auth'

import {getUserByIdDao} from '@/db/repositories/user-repository'
import {logger} from '@/lib/logger'

import {
  canOpenSessionOn,
  isMemberOf,
  organizationOfRequest,
} from './association-membership'
import {requestHostOf} from './association-origin'

export const ASSOCIATION_SESSION_GUARD_ID = 'association-session-guard'

/** Ce que le hook lit du contexte de l'appel : les en-tetes de la requete. */
type SessionRequestContext = {
  headers?: Headers
  request?: Request
} | null

/**
 * Le point de controle unique de la connexion (s46b, ADR 034) : toute creation
 * de session, quel que soit le mode, n'aboutit que pour le SuperAdmin ou pour
 * un membre de l'association du domaine appele. Contexte nul, en-tetes
 * absents, domaine sans association : refus (ferme par defaut). Le refus est un
 * `false`, pour que chaque mode rende son erreur generique, celle d'un compte
 * inconnu.
 */
const openSessionOnRequestDomain = async (
  session: {userId: string},
  context: SessionRequestContext
): Promise<boolean | void> => {
  const user = await getUserByIdDao(session.userId)
  if (!user) return false

  const headers = context?.headers ?? context?.request?.headers
  const organization = await organizationOfRequest(requestHostOf(headers))
  if (!canOpenSessionOn(user, organization)) return false
}

/** Ce que le hook lit de la session creee. */
type CreatedSession = {
  userId: string
  createdAt?: Date
  impersonatedBy?: string | null
}

/**
 * Premiere connexion reussie (s42a) : apres la creation de la session, pour un
 * compte **membre** de l'association du domaine appele, hors session ouverte a
 * sa place (s48). Le service est charge a l'appel (meme cycle d'imports que
 * `organizationOfRequest`). Un echec est journalise, sans adresse, et
 * n'empeche jamais la connexion.
 */
const recordFirstSignInOnRequestDomain = async (
  session: CreatedSession,
  context: SessionRequestContext
): Promise<void> => {
  try {
    if (session.impersonatedBy) return
    const headers = context?.headers ?? context?.request?.headers
    const organization = await organizationOfRequest(requestHostOf(headers))
    if (!organization) return
    const user = await getUserByIdDao(session.userId)
    if (!user || !isMemberOf(user, organization)) return

    const {recordFirstSignIn} =
      await import('@/services/member-invitation-service')
    await recordFirstSignIn({
      organizationId: organization.id,
      userId: session.userId,
      at: session.createdAt ?? new Date(),
    })
  } catch (error) {
    logger.error('[SESSION] Premiere connexion non enregistree', {
      reason: error instanceof Error ? error.message : 'inconnue',
    })
  }
}

/**
 * Plugin local, a placer **en tete** du tableau `plugins` : les hooks des
 * plugins passent dans l'ordre du tableau, et celui du plugin `admin()`
 * reveleraient sinon le bannissement d'un compte d'une autre association.
 */
export const associationSessionGuard = () =>
  ({
    id: ASSOCIATION_SESSION_GUARD_ID,
    init() {
      return {
        options: {
          databaseHooks: {
            session: {
              create: {
                before: openSessionOnRequestDomain,
                after: recordFirstSignInOnRequestDomain,
              },
            },
          },
        },
      }
    },
  }) satisfies BetterAuthPlugin
