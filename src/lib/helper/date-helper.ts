import {formatDistanceToNow} from 'date-fns'
import {enUS, es, fr, type Locale} from 'date-fns/locale'

const DATE_FNS_LOCALES: Record<string, Locale> = {en: enUS, fr, es}

const DEFAULT_LOCALE = 'fr'

/**
 * Résout la locale date-fns correspondant à une locale de l'application.
 * Retourne le français pour toute locale absente ou inconnue : c'est la locale
 * unique du produit (ADR 008).
 */
export const getDateFnsLocale = (locale?: string): Locale =>
  DATE_FNS_LOCALES[locale ?? DEFAULT_LOCALE] ?? fr

export const formatDateString = (dateString?: string, locale?: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString(locale ?? DEFAULT_LOCALE)
}

export const formatDate = (date: Date | null, locale?: string) => {
  if (!date) return ''
  return new Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export const formatDistanceToNowLocalized = (date: Date, locale?: string) => {
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: getDateFnsLocale(locale),
  })
}
