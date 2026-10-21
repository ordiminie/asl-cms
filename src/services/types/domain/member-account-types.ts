/**
 * Types de domaine du compte d'une fiche (s12d, ADR 037). Ecrits sans
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
}

/** Ce que l'enregistrement d'une fiche fait de son compte. */
export type MemberAccountDecision =
  | {kind: 'none'}
  | {kind: 'open'}
  | {kind: 'close'}
  | {kind: 'unlink'}
  | {kind: 'replace'; role: MemberAccountRole}
  | {kind: 'refuse_board_removal'}
