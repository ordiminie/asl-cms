/**
 * Date d'une mise a jour des factures (s20), heure de Paris : le produit est
 * servi en France (ADR 008). Isomorphe : le serveur et le navigateur rendent
 * la meme chaine, le fuseau etant explicite.
 */
const SYNC_TIME_ZONE = 'Europe/Paris'

const SYNC_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: SYNC_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** « 19/11/2026 », « 14 », « 05 » pour un instant ISO. */
export const syncTimePartsOf = (
  iso: string
): {date: string; hour: string; minute: string} => {
  const parts = Object.fromEntries(
    SYNC_FORMAT.formatToParts(new Date(iso)).map(({type, value}) => [
      type,
      value,
    ])
  )
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    hour: parts.hour,
    minute: parts.minute,
  }
}
