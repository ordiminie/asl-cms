import {hasLocale} from 'next-intl'

import {routing} from '@/i18n/routing'

/**
 * Retire le préfixe de locale d'un chemin quand il est déjà présent.
 *
 * `usePathname()` de next-intl retourne normalement un chemin sans locale, mais
 * sur les pages statiques la locale n'est pas résolue et le chemin revient
 * préfixé. Passer ce chemin tel quel à `router.replace(pathname, {locale})`
 * re-préfixe et produit `/fr/fr/dashboard`.
 *
 * On exige le slash séparateur ou l'égalité exacte : plus strict que le fix
 * d'origine (`startsWith('/' + locale)`) qui tronquait aussi `/french-page`.
 */
export const stripLocalePrefix = (pathname: string, locale: string): string => {
  if (!locale) return pathname

  const isPrefixed =
    pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`

  return isPrefixed ? pathname.slice(locale.length + 1) || '/' : pathname
}

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
