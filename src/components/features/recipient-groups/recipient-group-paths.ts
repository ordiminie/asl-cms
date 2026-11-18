/** Chemins du back-office des groupes de destinataires (s27). */
export const RECIPIENT_GROUPS_PATH = '/bureau/groupes'

export const recipientGroupPathOf = (id: string) =>
  `${RECIPIENT_GROUPS_PATH}/${id}`

/** Motif de route a revalider apres une modification d'un groupe. */
export const RECIPIENT_GROUPS_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/groupes'

/** La liste, apres la suppression d'un groupe : l'alerte de succes le nomme. */
export const deletedRecipientGroupPathOf = (name: string) =>
  `${RECIPIENT_GROUPS_PATH}?supprime=${encodeURIComponent(name)}`
