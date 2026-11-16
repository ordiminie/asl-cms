/**
 * Ordre des fiches reliees a un meme compte (s53, ADR 054 §7) : « Mes
 * terrains », coordonnees, et « la premiere fiche » quand un appelant n'en
 * veut qu'une (signalement, question, trace de role). Isomorphe : ni base,
 * ni horloge.
 */

const compareNumbers = (a: string, b: string): number =>
  a.localeCompare(b, 'fr', {numeric: true})

/** Le plus petit numero de parcelle actuelle, ou rien. */
const firstParcelNumber = (numbers: string[]): string | undefined =>
  [...numbers].sort(compareNumbers)[0]

const compareIds = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/**
 * Trie par premier numero de parcelle actuelle (ordre numerique francais),
 * fiches sans parcelle actuelle en dernier, puis par identifiant. Rend une
 * nouvelle liste.
 */
export const orderMyProfiles = <
  Profile extends {id: string; currentParcelNumbers: string[]},
>(
  profiles: Profile[]
): Profile[] =>
  [...profiles].sort((a, b) => {
    const firstA = firstParcelNumber(a.currentParcelNumbers)
    const firstB = firstParcelNumber(b.currentParcelNumbers)
    if (firstA !== undefined && firstB !== undefined) {
      const byNumber = compareNumbers(firstA, firstB)
      if (byNumber !== 0) return byNumber
    } else if (firstA !== undefined) {
      return -1
    } else if (firstB !== undefined) {
      return 1
    }
    return compareIds(a.id, b.id)
  })
