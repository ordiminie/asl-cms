import {headers} from 'next/headers'

import {getPostLoginPathDal} from '@/app/dal/user-dal'
import {auth} from '@/lib/better-auth/auth'
import {logger} from '@/lib/logger'
import {getSessionAuth} from '@/services/authentication/auth-service'

/**
 * Route de passage d'un acces ferme (s12d, ecran D, ADR 038). Une session est
 * encore ouverte, mais le compte n'a plus acces a l'association du domaine :
 * la session courante est fermee par Better Auth — ses cookies effaces dans
 * la reponse — puis un 307 relatif mene a la connexion, qui affiche le
 * message. Ferme cette session seulement : celles du compte sur d'autres
 * associations restent ouvertes (critere 3).
 *
 * La session n'est fermee que si l'acces l'est vraiment : sans session, la
 * route renvoie a la connexion ; avec un acces ouvert, a la destination
 * apres connexion, sans message. L'acces est ouvert exactement quand cette
 * destination existe : `getPostLoginPathDal()` ne rend rien que si
 * `getAuthUser()` ne rend aucun compte de l'association du domaine.
 */
const CLOSED_ACCESS_LOGIN = '/login?acces=ferme'

const signOutCookies = async (): Promise<string[]> => {
  try {
    const response = await auth.api.signOut({
      headers: await headers(),
      asResponse: true,
    })
    return response.headers.getSetCookie()
  } catch (error) {
    logger.error('[ACCES-FERME] Echec de la fermeture de session', error)
    return []
  }
}

const redirectTo = (location: string): Response =>
  new Response(null, {status: 307, headers: {Location: location}})

export async function GET(): Promise<Response> {
  const session = await getSessionAuth()
  if (!session?.session?.userId) return redirectTo('/login')

  const openAccessDestination = await getPostLoginPathDal()
  if (openAccessDestination) return redirectTo(openAccessDestination)

  const responseHeaders = new Headers({Location: CLOSED_ACCESS_LOGIN})
  for (const cookie of await signOutCookies()) {
    responseHeaders.append('set-cookie', cookie)
  }

  return new Response(null, {status: 307, headers: responseHeaders})
}
