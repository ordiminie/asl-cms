/**
 * Date d'un contenu date (actualite, analyse d'eau) en clair
 * (« 2 septembre 2026 »), rendue **en UTC** a partir de la date ISO stockee :
 * les colonnes `date` n'ont ni heure ni fuseau, et une conversion locale la
 * ferait glisser d'un jour.
 *
 * Fonction pure, sans lecture d'horloge : utilisable dans un scope
 * `'use cache'`.
 */
export const formatContentDate = (isoDate: string, locale = 'fr-FR'): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
