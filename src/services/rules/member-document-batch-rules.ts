/**
 * Regles pures du depot en lot des documents nominatifs (s32, ADR 073 §8).
 * Isomorphes : ni base, ni horloge, ni import serveur.
 */

const REFERENCE_SEPARATOR = '_'

/**
 * La reference client Pennylane que porte le nom d'un fichier : la partie qui
 * precede le **premier** `_`, sans espaces et en minuscules. Rien quand le
 * nom n'a pas de `_` ou commence par lui : la ligne sera ecartee, jamais
 * rattachee a une fiche par defaut.
 */
export const referenceOfBatchFileName = (name: string): string | undefined => {
  const separatorAt = name.indexOf(REFERENCE_SEPARATOR)
  if (separatorAt === -1) return undefined

  const reference = name
    .slice(0, separatorAt)
    .replaceAll(/\s+/g, '')
    .toLowerCase()
  return reference === '' ? undefined : reference
}
