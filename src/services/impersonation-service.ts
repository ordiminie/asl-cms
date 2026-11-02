import 'server-only'

import {isAPIError} from 'better-auth/api'
import {headers} from 'next/headers'

import {insertImpersonationEventDao} from '@/db/repositories/impersonation-event-repository'
import {getOrganizationByDomainDao} from '@/db/repositories/organization-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'
import {requestHostOf} from '@/lib/better-auth/association-origin'
import {auth} from '@/lib/better-auth/auth'
import {isUserBanned} from '@/lib/helper/auth-helper'
import {normalizeTenantHost} from '@/lib/helper/tenant-helper'
import {logger} from '@/lib/logger'

import {getActingContext, getSessionAuth} from './authentication/auth-service'
import {postLoginPathOf} from './authorization/association-authorization'
import {canImpersonateAccount} from './authorization/impersonation-authorization'
import {ValidationParsedZodError} from './errors/validation-error'
import {RoleConst} from './types/domain/auth-types'
import {
  OpenImpersonationInput,
  OpenImpersonationRefusal,
  OpenImpersonationResult,
  StopImpersonationResult,
} from './types/domain/impersonation-types'
import {User} from './types/domain/user-types'
import {openImpersonationServiceSchema} from './validation/impersonation-validation'

/**
 * Agir a la place d'un compte (s48, ADR 041) : le seul chemin d'ouverture et de
 * sortie. Les routes HTTP du plugin admin() sont fermees ; ce service appelle
 * `auth.api.*` avec les en-tetes de la requete (le controle d'association de
 * l'ADR 034 lit l'hote), puis ecrit la trace dans la meme requete.
 */

/** Les refus de Better Auth, traduits dans le vocabulaire du service. */
const REFUSAL_OF_AUTH_CODE: Record<string, OpenImpersonationRefusal> = {
  BANNED_USER: 'suspended',
  YOU_CANNOT_IMPERSONATE_ADMINS: 'target_is_admin',
  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: 'forbidden',
}

/** L'association servie par le domaine appele, s'il en sert une. */
const organizationIdOfRequest = async (
  requestHeaders: Headers
): Promise<string | undefined> => {
  const domain = normalizeTenantHost(requestHostOf(requestHeaders))
  if (!domain) return undefined
  return (await getOrganizationByDomainDao(domain))?.id
}

const isMemberOf = (account: User, organizationId: string) =>
  (account.organizations ?? []).some(
    (membership) => membership.organizationId === organizationId
  )

/** Le compte vise, s'il peut l'etre ; sinon le refus a rendre. */
const checkTarget = async (
  userId: string,
  organizationId: string
): Promise<{target: User} | {refusal: OpenImpersonationRefusal}> => {
  const target = await getUserByIdDao(userId)
  if (!target || !isMemberOf(target, organizationId)) {
    return {refusal: 'target_not_found'}
  }
  if (target.role === RoleConst.SUPER_ADMIN) {
    return {refusal: 'target_is_admin'}
  }
  if (isUserBanned(target)) return {refusal: 'suspended'}
  return {target}
}

/** Ouvre la session par Better Auth ; un refus connu devient un statut. */
const openSessionAs = async (
  requestHeaders: Headers,
  userId: string
): Promise<{sessionId: string} | {refusal: OpenImpersonationRefusal}> => {
  try {
    const {session} = await auth.api.impersonateUser({
      headers: requestHeaders,
      body: {userId},
    })
    return {sessionId: session.id}
  } catch (error) {
    const code = isAPIError(error) ? String(error.body?.code ?? '') : ''
    const refusal = REFUSAL_OF_AUTH_CODE[code]
    if (refusal) return {refusal}
    throw error
  }
}

/**
 * Une session ouverte dont la trace n'a pas pu etre ecrite est refermee : aucune
 * session a la place ne doit survivre sans trace (ADR 041). Best effort : un
 * echec de fermeture est journalise, l'erreur de trace reste celle qui remonte.
 */
const closeUntracedSession = async (
  requestHeaders: Headers,
  sessionId: string
) => {
  try {
    await auth.api.stopImpersonating({headers: requestHeaders})
  } catch (closeError) {
    logger.error('[IMPERSONATION] session non tracée non refermée', {
      sessionId,
      error: closeError,
    })
  }
}

/**
 * Ouvre une session a la place d'un compte de l'association (criteres 1, 3,
 * 4) : SuperAdmin seul, sur le domaine de l'association, compte membre, ni
 * SuperAdmin ni suspendu, jamais deux sessions enchainees. La trace `opened`
 * n'est ecrite que si la session a ete ouverte.
 *
 * Better Auth interroge la base par le meme pool : l'appeler dans un
 * `withTenant`, qui retient une connexion, interbloque un pool a une connexion
 * (`DATABASE_POOL_MAX`). Seul le travail en base passe donc sous le tenant.
 */
export const openImpersonationService = async (
  input: OpenImpersonationInput
): Promise<OpenImpersonationResult> => {
  const acting = await getActingContext()
  if (acting?.impersonator) return {status: 'already_impersonating'}
  if (!acting || !canImpersonateAccount(acting.user)) {
    return {status: 'forbidden'}
  }
  const admin = acting.user

  const parsed = openImpersonationServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const {organizationId, userId} = parsed.data
  const reason = parsed.data.reason || null

  const requestHeaders = await headers()
  if ((await organizationIdOfRequest(requestHeaders)) !== organizationId) {
    return {status: 'wrong_domain'}
  }

  const checked = await withTenant(organizationId, () =>
    checkTarget(userId, organizationId)
  )
  if ('refusal' in checked) return {status: checked.refusal}
  const {target} = checked

  const opened = await openSessionAs(requestHeaders, target.id)
  if ('refusal' in opened) return {status: opened.refusal}

  try {
    await withTenant(organizationId, () =>
      insertImpersonationEventDao({
        organizationId,
        kind: 'opened',
        adminUserId: admin.id,
        adminName: admin.name,
        targetUserId: target.id,
        targetName: target.name,
        sessionId: opened.sessionId,
        reason,
      })
    )
  } catch (error) {
    await closeUntracedSession(requestHeaders, opened.sessionId)
    throw error
  }
  return {status: 'opened', url: postLoginPathOf(target, organizationId)}
}

/**
 * Sortie explicite (critere 2) : Better Auth supprime la session a la place et
 * rend la session SuperAdmin d'origine, puis la sortie est tracee `closed`. Le
 * SuperAdmin revient a l'ecran des membres de l'association.
 */
export const stopImpersonationService =
  async (): Promise<StopImpersonationResult> => {
    const acting = await getActingContext()
    if (!acting?.impersonator) return {status: 'not_impersonating'}
    const {user: target, impersonator} = acting

    const requestHeaders = await headers()
    const organizationId = await organizationIdOfRequest(requestHeaders)
    if (!organizationId) {
      throw new Error(
        'Session à la place d’un compte hors du domaine d’une association'
      )
    }
    const sessionId = (await getSessionAuth())?.session?.id ?? null

    await auth.api.stopImpersonating({headers: requestHeaders})

    await withTenant(organizationId, () =>
      insertImpersonationEventDao({
        organizationId,
        kind: 'closed',
        adminUserId: impersonator.id,
        adminName: impersonator.name,
        targetUserId: target.id,
        targetName: target.name,
        sessionId,
        reason: null,
      })
    )
    return {
      status: 'closed',
      url: `/admin/organizations/${organizationId}/edit?retour=1`,
    }
  }
