import {createTranslator} from 'next-intl'

import {routing} from '@/i18n/routing'

import en from '../../messages/en.json'
import es from '../../messages/es.json'
import fr from '../../messages/fr.json'

const MESSAGES = {en, es, fr} as const

type TranslationsArgument =
  string | {locale: keyof typeof MESSAGES; namespace?: string}

/**
 * `getTranslations` tel que `src/i18n/request.ts` le rend dans une Server
 * Action ou un Route Handler sans cookie `NEXT_LOCALE` (navigateur neuf) : sans
 * locale explicite, `routing.defaultLocale`. Une locale explicite est servie
 * telle quelle. C'est ce qui a envoye l'email de connexion en anglais en CI.
 */
export const getTranslationsWithoutLocaleCookie = async (
  argument: TranslationsArgument
) => {
  const {locale, namespace} =
    typeof argument === 'string'
      ? {
          locale: routing.defaultLocale as keyof typeof MESSAGES,
          namespace: argument,
        }
      : argument
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: namespace as never,
  })
}
