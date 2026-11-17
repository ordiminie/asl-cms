/**
 * Types de domaine du compte d'une fiche (s12d ; lien par table, s53, ADR 054). Ecrits sans
 * importer le modele Drizzle (`rule-architecture`).
 */

/** Role d'une ligne `member` dans une association (plan identite). */
export type MemberAccountRole = 'member' | 'board' | 'owner'

export const MemberAccountRoleConst = {
  MEMBER: 'member',
  BOARD: 'board',
  OWNER: 'owner',
} as const satisfies Record<string, MemberAccountRole>

export type MemberAccountDecisionInput = {
  /** Adresse enregistree sur la fiche, `null` si absente. */
  savedEmail: string | null
  /** Adresse demandee, `null` si le bureau la vide. */
  nextEmail: string | null
  /**
   * Role, dans cette association, du compte lie a la fiche ; `null` si la
   * fiche n'a pas de compte.
   */
  linkedRole: MemberAccountRole | null
  /**
   * Un compte est-il encore relie a la fiche par l'adresse enregistree, avec
   * ou sans ligne `member` (revue s54 round 4, MA-r4) ?
   */
  previousAccountLinked: boolean
  /**
   * Nombre d'**autres** fiches de l'association reliees au compte de la
   * fiche (s53, ADR 054) : 0 quand la fiche est la derniere, ou sans compte.
   */
  otherLinkedProfiles: number
  /**
   * Compte de l'association qui porte deja l'adresse demandee par une autre
   * fiche (s53, ADR 054 §4) ; `null` si aucun.
   */
  nextEmailAccountUserId: string | null
}

/** Ce que l'enregistrement d'une fiche fait de son compte. */
export type MemberAccountDecision =
  | {kind: 'none'}
  | {kind: 'open'}
  | {kind: 'close'}
  | {kind: 'unlink'}
  | {kind: 'replace'}
  /** L'adresse est celle d'un compte de l'association : la fiche le rejoint. */
  | {kind: 'link_shared'; userId: string}
  | {kind: 'refuse_board_removal'}

/**
 * Auteur d'un changement de compte : la personne connectee qui enregistre la
 * fiche, copiee dans la trace des roles (s14, D5).
 */
export type MemberAccountAuthor = {
  userId: string | null
  name: string | null
  /** Le compte vu quand le SuperAdmin agit a sa place (s48), sinon nul. */
  onBehalfOfUserId?: string | null
  onBehalfOfName?: string | null
}
