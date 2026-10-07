/**
 * Prefixes de langue que le site a servis avant la locale unique (ADR 008,
 * ADR 031). Leurs adresses ont pu etre partagees ou indexees : elles sont
 * redirigees de facon permanente vers l'adresse sans prefixe.
 *
 * **Une liste, trois usages** : les redirections de `next.config.ts`, les
 * interdictions prefixees de `robots.txt` et les slugs reserves du CMS.
 *
 * Ce module est lu par `next.config.ts`, evalue avant `@/env` et hors de
 * l'alias `@/` : il n'importe rien.
 */
export const LEGACY_LOCALE_PREFIXES = ['fr', 'en', 'es'] as const

export type LegacyLocaleRedirect = {
  source: string
  destination: string
  permanent: true
}

/** Regles de `redirects()` : l'adresse exacte et ses sous-chemins, en 308. */
export const legacyLocaleRedirects = (): LegacyLocaleRedirect[] =>
  LEGACY_LOCALE_PREFIXES.flatMap((prefix) => [
    {source: `/${prefix}`, destination: '/', permanent: true},
    {source: `/${prefix}/:path*`, destination: '/:path*', permanent: true},
  ])
