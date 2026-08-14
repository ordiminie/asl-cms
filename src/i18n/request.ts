import {notFound} from 'next/navigation'
import * as rootParams from 'next/root-params'
import {hasLocale} from 'next-intl'
import {getRequestConfig} from 'next-intl/server'

import {routing} from './routing'

/*
 * La locale est lue via `next/root-params` plutôt que `requestLocale` : c'est ce
 * qui permet à next-intl de fonctionner sous Cache Components, la lecture du
 * contexte de requête rendant sinon tout l'arbre dynamique.
 * Limite connue : root-params n'est pas disponible dans les Route Handlers ni
 * les Server Actions — y passer la locale explicitement.
 */
export default getRequestConfig(async () => {
  const paramValue = await rootParams.locale()

  if (!hasLocale(routing.locales, paramValue)) {
    notFound()
  }

  return {
    locale: paramValue,
    messages: (await import(`../../messages/${paramValue}.json`)).default,
  }
})
