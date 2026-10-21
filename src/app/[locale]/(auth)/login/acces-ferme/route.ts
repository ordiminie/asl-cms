import {headers} from 'next/headers'

import {auth} from '@/lib/better-auth/auth'
import {logger} from '@/lib/logger'

/**
 * Route de passage d'un acces ferme (s12d, ecran D, ADR 038). Une session est
 * encore ouverte, mais le compte n'a plus acces a l'association du domaine :
 * la session courante est fermee par Better Auth — ses cookies effaces dans
 * la reponse — puis un 307 relatif mene a la connexion, qui affiche le
 * message. Ferme cette session seulement : celles du compte sur d'autres
 * associations restent ouvertes (critere 3).
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

export async function GET(): Promise<Response> {
  const responseHeaders = new Headers({Location: CLOSED_ACCESS_LOGIN})
  for (const cookie of await signOutCookies()) {
    responseHeaders.append('set-cookie', cookie)
  }

  return new Response(null, {status: 307, headers: responseHeaders})
}
