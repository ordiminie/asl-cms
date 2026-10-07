import {defineRouting} from 'next-intl/routing'

/*
 * Locale unique, sans prefixe d'URL (ADR 008). Les anciennes adresses /fr,
 * /en et /es sont redirigees par next.config.ts (ADR 031).
 */
export const routing = defineRouting({
  locales: ['fr'],
  defaultLocale: 'fr',
  localePrefix: 'never',
})
