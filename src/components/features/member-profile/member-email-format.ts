const MEMBER_EMAIL_TIME_ZONE = 'Europe/Paris'

const SHORT_DAY_FORMAT = new Intl.DateTimeFormat('fr', {
  timeZone: MEMBER_EMAIL_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
})

/**
 * L'echeance d'une adresse en attente, en `jj/mm` heure de Paris, comme dans
 * « jusqu'au 23/11 » (s54).
 */
export const shortDayOfInstant = (instant: string): string =>
  SHORT_DAY_FORMAT.format(new Date(instant))

const DAY_FORMAT = new Intl.DateTimeFormat('fr', {
  timeZone: MEMBER_EMAIL_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Le jour d'un instant, en `jj/mm/aaaa` heure de Paris, comme dans « Invitée
 * le 24/11/2026 » (s42a).
 */
export const dayOfInstant = (instant: string): string =>
  DAY_FORMAT.format(new Date(instant))
