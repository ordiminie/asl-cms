import {headers} from 'next/headers'

import {organizationOfRequest} from './association-membership'
import {
  associationOriginOf,
  rebaseMagicLinkUrl,
  requestHostOf,
} from './association-origin'

/**
 * En-tetes de la requete Next en cours ; rien hors requete (script, tache
 * planifiee), ou `headers()` leve.
 */
const currentRequestHeaders = async (): Promise<Headers | undefined> => {
  try {
    return await headers()
  } catch {
    return undefined
  }
}

/**
 * Lien de verification d'email, de changement d'adresse ou de reinitialisation
 * du mot de passe, reporte sur l'origine de l'association du domaine appele
 * (revues M2 et M1′ de s46b, ADR 022, ADR 034). Better Auth le construit sur `BETTER_AUTH_URL` ; ouvert la, il
 * creerait sa session sur l'hote de la plateforme, ou le controle
 * d'association la refuse. Rebase comme le lien magique, il ouvre la session
 * sur le domaine de l'association.
 *
 * L'hote vient de la `Request` que Better Auth 1.7.1 passe au callback
 * (appel HTTP), sinon des en-tetes de la requete Next (appel direct
 * `auth.api.*` depuis une Server Action : Better Auth passe alors
 * `undefined`). Hote sans association (le SuperAdmin sur la plateforme) ou
 * illisible : le lien reste sur la plateforme, comme avant.
 */
export const verificationLinkOnAssociation = async (
  url: string,
  request?: Request
): Promise<string> => {
  const requestHeaders = request?.headers ?? (await currentRequestHeaders())
  const host = requestHostOf(requestHeaders)
  if (!host) return url

  const organization = await organizationOfRequest(host)
  const origin = associationOriginOf(organization?.domain)
  return origin ? rebaseMagicLinkUrl(url, origin) : url
}
