import 'server-only'

import {headers} from 'next/headers'

/**
 * Adresse IP du visiteur : la **derniere** entree non vide de
 * `x-forwarded-for`, celle qu'ajoute le reverse proxy de confiance, sinon
 * `x-real-ip`. Jamais la premiere, fournie par le client : un limiteur qui la
 * lit se contourne en changeant une valeur d'en-tete (s08b, decision B).
 *
 * Seule regle de lecture d'IP du produit (s10, decision E) : les formulaires
 * publics limites l'importent, aucun ne la recopie. L'adresse lue n'est
 * transmise qu'au limiteur.
 */
export const readVisitorIp = async (): Promise<string | undefined> => {
  const requestHeaders = await headers()
  const forwarded = requestHeaders
    .get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .findLast((entry) => entry !== '')
  return forwarded ?? requestHeaders.get('x-real-ip')?.trim() ?? undefined
}
