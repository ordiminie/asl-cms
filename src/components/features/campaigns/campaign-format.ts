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

/** Un jour ISO `YYYY-MM-DD` en `jj/mm/aaaa` : le jour est deja celui de Paris. */
export const dayLabelOf = (day: string): string => {
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

/** Un jour ISO `YYYY-MM-DD` en `jj/mm`, comme dans « Programmée pour le 14/11 ». */
export const shortDayLabelOf = (day: string): string =>
  dayLabelOf(day).slice(0, 5)

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('fr', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const DAYS_LIST_FORMAT = new Intl.ListFormat('fr', {
  style: 'long',
  type: 'conjunction',
})

/**
 * Des jours ISO en toutes lettres, le mois ecrit une fois par groupe :
 * « 13 et 14 novembre », « 30 novembre et 1 decembre ».
 */
export const daysInWordsOf = (days: readonly string[]): string => {
  const groups: {month: string; dates: string[]}[] = []
  for (const day of days) {
    const [date, ...month] = DAY_MONTH_FORMAT.format(
      new Date(`${day}T00:00:00Z`)
    ).split(' ')
    const name = month.join(' ')
    const last = groups.at(-1)
    if (last?.month === name) last.dates.push(date)
    else groups.push({month: name, dates: [date]})
  }
  if (groups.length === 1) {
    return `${DAYS_LIST_FORMAT.format(groups[0].dates)} ${groups[0].month}`
  }
  return DAYS_LIST_FORMAT.format(
    groups.flatMap((group) =>
      group.dates.map((date) => `${date} ${group.month}`)
    )
  )
}
