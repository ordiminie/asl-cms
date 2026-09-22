/**
 * Date d'une actualite en clair (« 2 septembre 2026 »), rendue **en UTC** a
 * partir de la date ISO stockee : la colonne `published_on` n'a ni heure ni
 * fuseau, et une conversion locale la ferait glisser d'un jour.
 *
 * Fonction pure, sans lecture d'horloge : utilisable dans un scope
 * `'use cache'`.
 */
export const formatNewsDate = (isoDate: string, locale = 'fr-FR'): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
