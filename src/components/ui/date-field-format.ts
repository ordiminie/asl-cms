/**
 * Conversions du champ date (§3.9), isomorphes : pures, sans horloge, elles
 * servent aussi bien le champ (client) que les listes rendues cote serveur.
 */

const DATE_DIGITS = 8

/**
 * Masque `jj/mm/aaaa` applique a la frappe : seuls les chiffres comptent, et
 * une barre n'apparait que devant le chiffre qui la suit. Un collage de
 * `02/09/2026` ne double donc pas les barres, et la suppression arriere
 * retraverse une barre sans s'y bloquer.
 */
export const maskFrenchDate = (raw: string): string => {
  const digits = raw.replaceAll(/\D/g, '').slice(0, DATE_DIGITS)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4)

  return [day, month, year].filter((part) => part !== '').join('/')
}

/**
 * `02/09/2026` -> `2026-09-02`. Rien pour une saisie partielle ou une date qui
 * n'existe pas (`31/02/2026`) : la verification se fait en UTC, sans lire
 * l'horloge.
 */
export const frenchDateToIso = (value: string): string | undefined => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return undefined

  const [, day, month, year] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const exists =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)

  return exists ? `${year}-${month}-${day}` : undefined
}

/** `2026-09-02` -> `02/09/2026`, sans passer par un fuseau. */
export const isoToFrenchDate = (isoDate: string): string =>
  isoDate.split('-').reverse().join('/')
