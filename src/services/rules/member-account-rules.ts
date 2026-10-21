import {
  MemberAccountDecision,
  MemberAccountDecisionInput,
  MemberAccountRoleConst,
} from '../types/domain/member-account-types'

/**
 * Regle pure du compte d'une fiche (s12d, ADR 037) : l'acces a l'espace se
 * pilote par l'adresse email de la fiche. Isomorphe : ni base, ni horloge.
 */

const normalized = (email: string | null): string | null =>
  email === null ? null : email.trim().toLowerCase()

/** Deux adresses egales sans casse ; deux absences sont egales. */
export const sameEmail = (a: string | null, b: string | null): boolean =>
  normalized(a) === normalized(b)

/**
 * Decision a partir de l'adresse enregistree, de l'adresse demandee et du
 * role du compte lie. Un membre du bureau ou la presidence garde une adresse
 * (modifiable, jamais supprimable) et son role suit la nouvelle adresse.
 * Une adresse videe sans ligne `member` lue ici delie la fiche sans rien
 * fermer : une fiche courrier ne garde jamais de compte lie.
 */
export const decideMemberAccount = ({
  savedEmail,
  nextEmail,
  linkedRole,
}: MemberAccountDecisionInput): MemberAccountDecision => {
  if (nextEmail === null) {
    if (linkedRole === null) return {kind: 'unlink'}
    if (linkedRole !== MemberAccountRoleConst.MEMBER) {
      return {kind: 'refuse_board_removal'}
    }
    return {kind: 'close'}
  }

  if (linkedRole === null) return {kind: 'open'}
  if (sameEmail(savedEmail, nextEmail)) return {kind: 'none'}
  return {kind: 'replace', role: linkedRole}
}
