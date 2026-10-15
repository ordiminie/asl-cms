import type {BetterAuthPlugin} from 'better-auth'

import {getUserByIdDao} from '@/db/repositories/user-repository'

import {canOpenSessionOn, organizationOfRequest} from './association-membership'
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
              create: {before: openSessionOnRequestDomain},
            },
          },
        },
      }
    },
  }) satisfies BetterAuthPlugin
