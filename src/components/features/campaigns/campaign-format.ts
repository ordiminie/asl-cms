const CAMPAIGN_TIME_ZONE = 'Europe/Paris'

const partsOf = (instant: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('fr', {timeZone: CAMPAIGN_TIME_ZONE, ...options})
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value])
  )

/** L'instant d'envoi, heure de Paris, en morceaux d'un tableau : 12/11/2026, 14:32. */
export const sentAtPartsOf = (
  instant: string
): {date: string; time: string} => {
  const day = partsOf(instant, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const clock = partsOf(instant, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return {
    date: `${day.day}/${day.month}/${day.year}`,
    time: `${clock.hour}:${clock.minute}`,
  }
}
