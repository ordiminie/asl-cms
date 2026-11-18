/** Chemins du back-office des groupes de destinataires (s27). */
export const RECIPIENT_GROUPS_PATH = '/bureau/groupes'

export const recipientGroupPathOf = (id: string) =>
  `${RECIPIENT_GROUPS_PATH}/${id}`

/** Motif de route a revalider apres une modification d'un groupe. */
export const RECIPIENT_GROUPS_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/groupes'

/** Le drapeau de la liste apres la suppression d'un groupe. */
export const RECIPIENT_GROUP_DELETED_FLAG = '1'

/**
 * La liste, apres la suppression d'un groupe (revue m2) : un drapeau, jamais
 * le nom, qui finirait dans l'historique et les journaux du proxy.
 */
export const DELETED_RECIPIENT_GROUP_PATH = `${RECIPIENT_GROUPS_PATH}?supprime=${RECIPIENT_GROUP_DELETED_FLAG}`
