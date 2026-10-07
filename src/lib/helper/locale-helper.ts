import {hasLocale} from 'next-intl'

import {routing} from '@/i18n/routing'

export type SupportedLocale = (typeof routing.locales)[number]

/**
 * Locale du produit quand aucune n'est connue : ASL-CMS est servi en francais
 * seulement (ADR 008). Ce n'est pas une valeur metier d'association, l'ADR 010
 * ne s'applique pas.
 */
export const PRODUCT_LOCALE: SupportedLocale = 'fr'

/**
 * Locale fournie par l'appelant (formulaire, metadonnees d'une requete),
 * gardee seulement si le routage la sert ; sinon la locale du produit. Une
 * valeur non verifiee ne doit jamais choisir un fichier de messages.
 */
export const resolveSupportedLocale = (value: unknown): SupportedLocale =>
  typeof value === 'string' && hasLocale(routing.locales, value)
    ? value
    : PRODUCT_LOCALE
