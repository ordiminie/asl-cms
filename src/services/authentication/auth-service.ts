import {headers} from 'next/headers'
import {cache} from 'react'

import {getUserByIdDao} from '@/db/repositories/user-repository'
import {
  canOpenSessionOn,
  organizationOfRequest,
} from '@/lib/better-auth/association-membership'
import {requestHostOf} from '@/lib/better-auth/association-origin'
import {auth} from '@/lib/better-auth/auth'
import {getReferenceIdByBillingMode} from '@/lib/helper/subscription-helper'
import type {ActingContext} from '@/services/types/domain/impersonation-types'

/**
 * Récupère l'utilisateur connecté a partir de la session enrichie
 * Attention : expose toutes les données
 * préferer 'getAuthUserDTO' pour exposition aux clients
 *
 * A chaque lecture, la regle d'ouverture de session de l'ADR 034 est
 * rejouee sur l'association du domaine appele (s12d, ADR 038) : un compte
 * dont l'acces a ete ferme est traite comme non connecte, a la requete
 * suivante, meme si sa session est encore ouverte. Le SuperAdmin passe
 * partout.
 * @returns L'utilisateur connecté avec organizations et settings
 */
export const getAuthUser = cache(async () => {
  const session = await getSessionAuth()
  if (!session?.session?.userId) return
  // customSession relit le compte et ses appartenances en base a chaque appel
  const organization = await organizationOfRequest(
    requestHostOf(await headers())
  )
  if (!session.user || !canOpenSessionOn(session.user, organization)) return
  return session.user
})

export const getSessionAuth = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(), // you need to pass the headers object.
  })
  return session
})

export const getSessionActiveOrganizationId = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(), // you need to pass the headers object.
  })
  return session?.session?.activeOrganizationId
})

export const getSessionReferenceId = cache(async () => {
  const session = await getSessionAuth()
  return getReferenceIdByBillingMode(
    session?.session?.userId,
    session?.session?.activeOrganizationId ?? undefined
  )
})

export const getActiveSubscriptions = cache(async (referenceId: string) => {
  try {
    const subscriptions = await auth.api.listActiveSubscriptions({
      headers: await headers(),
      query: {
        referenceId,
      },
    })
    return subscriptions
  } catch (error) {
    console.error('Error fetching active subscriptions:', error)
    return []
  }
})
export const getAuthUserId = async () => {
  const user = await getAuthUser()
  if (!user) return
  return user.id
}

/**
 * Qui agit (s48, ADR 041) : le compte vu, tel que `getAuthUser()` le rend, et,
 * si la session a ete ouverte a sa place, le SuperAdmin qui agit
 * (`session.impersonatedBy`). L'autorisation continue de juger le compte vu ;
 * seules les traces changent d'auteur. Un imitateur introuvable est une
 * incoherence : on refuse plutot que d'attribuer l'acte au compte vu.
 */
export const getActingContext = cache(
  async (): Promise<ActingContext | undefined> => {
    const user = await getAuthUser()
    if (!user) return
    const session = await getSessionAuth()
    const impersonatedBy = session?.session?.impersonatedBy
    if (!impersonatedBy) return {user}

    const impersonator = await getUserByIdDao(impersonatedBy)
    if (!impersonator) {
      throw new Error(
        `Session à la place d'un compte : imitateur ${impersonatedBy} introuvable`
      )
    }
    return {user, impersonator: {id: impersonator.id, name: impersonator.name}}
  }
)
