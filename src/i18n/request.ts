import {cookies} from 'next/headers'
import {notFound} from 'next/navigation'
import * as rootParams from 'next/root-params'
import {hasLocale} from 'next-intl'
import {getRequestConfig} from 'next-intl/server'

import {routing} from './routing'

/*
 * La locale vient de `next/root-params` : c'est ce qui permet à next-intl de
 * fonctionner sous Cache Components, la lecture du contexte de requête rendant
 * sinon tout l'arbre dynamique.
 *
 * root-params n'existe pas dans les Server Actions ni les Route Handlers — il y
 * jette « can only be called in the context of a route ». On retombe alors sur
 * le cookie NEXT_LOCALE, posé par le proxy next-intl.
 *
 * Le fallback est volontairement **paresseux** : il ne s'évalue que si
 * root-params a échoué, donc jamais pendant un prerender. Ne pas déstructurer
 * `requestLocale` dans la signature — next-intl le résout en amont via
 * `headers()`, ce qui casse toute page portant `'use cache'`.
 */
export default getRequestConfig(async () => {
  let paramValue: string | undefined

  try {
    paramValue = await rootParams.locale()
  } catch {
    const cookieStore = await cookies()
    paramValue = cookieStore.get('NEXT_LOCALE')?.value ?? routing.defaultLocale
  }

  if (!hasLocale(routing.locales, paramValue)) {
    notFound()
  }

  return {
    locale: paramValue,
    messages: (await import(`../../messages/${paramValue}.json`)).default,
  }
})
