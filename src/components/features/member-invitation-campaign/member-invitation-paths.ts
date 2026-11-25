/** La page « Invitations des membres » du bureau (s42b). */
export const MEMBER_INVITATIONS_PATH = '/bureau/invitations'

/** Une page de la liste des adresses jamais connectees. */
export const memberInvitationsPagePathOf = (page: number): string =>
  page > 1 ? `${MEMBER_INVITATIONS_PATH}?page=${page}` : MEMBER_INVITATIONS_PATH
