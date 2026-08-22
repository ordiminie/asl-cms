import {formatDistanceToNow} from 'date-fns'
import {enUS, es, fr, type Locale} from 'date-fns/locale'

const DATE_FNS_LOCALES: Record<string, Locale> = {en: enUS, fr, es}

const DEFAULT_LOCALE = 'en'

/**
 * Résout la locale date-fns correspondant à une locale de l'application.
 * Retourne l'anglais pour toute locale inconnue, comme `routing.defaultLocale`.
 */
export const getDateFnsLocale = (locale?: string): Locale =>
  DATE_FNS_LOCALES[locale ?? DEFAULT_LOCALE] ?? enUS

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
