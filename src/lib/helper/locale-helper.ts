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
