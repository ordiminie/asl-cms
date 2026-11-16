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
 * Decision a partir de l'adresse enregistree, de l'adresse demandee, du role
 * du compte lie et des autres fiches de ce compte (s53, ADR 054). Un membre
 * du bureau ou la presidence garde une adresse sur sa **derniere** fiche
 * (modifiable, jamais supprimable). Une adresse deja celle d'un compte de
 * l'association relie la fiche a ce compte. Une adresse videe sans ligne
 * `member` lue ici delie la fiche sans rien fermer : une fiche courrier ne
 * garde jamais de compte lie.
 */
export const decideMemberAccount = ({
  savedEmail,
  nextEmail,
  linkedRole,
  otherLinkedProfiles,
  nextEmailAccountUserId,
}: MemberAccountDecisionInput): MemberAccountDecision => {
  if (nextEmail === null) {
    if (linkedRole === null) return {kind: 'unlink'}
    if (
      linkedRole !== MemberAccountRoleConst.MEMBER &&
      otherLinkedProfiles === 0
    ) {
      return {kind: 'refuse_board_removal'}
    }
    return {kind: 'close'}
  }

  if (linkedRole !== null && sameEmail(savedEmail, nextEmail)) {
    return {kind: 'none'}
  }
  if (nextEmailAccountUserId !== null) {
    return {kind: 'link_shared', userId: nextEmailAccountUserId}
  }
  if (linkedRole === null) return {kind: 'open'}
  return {kind: 'replace'}
}
