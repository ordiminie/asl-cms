import {
  MemberAccountRole,
  MemberAccountRoleConst,
} from '../types/domain/member-account-types'
import {
  ASSIGNABLE_MEMBER_ROLES,
  MemberRoleCardDTO,
  MemberRoleCardViewer,
  MemberRoleChangeDecision,
  MemberRoleChangeInput,
} from '../types/domain/member-role-types'

/**
 * Regle pure du changement de role d'association (s14, ADR 039). Isomorphe :
 * ni base, ni horloge. L'autorisation d'agir (`canAssignMemberRole`) est
 * verifiee avant ; cette regle tranche ce que la personne autorisee peut
 * faire de **ce** role.
 *
 * - Une seule President(e) : seule elle transmet la presidence, depuis la fiche
 *   du successeur, et ne modifie pas son propre role.
 * - Le SuperAdmin agit comme un membre du Bureau (D4), meme titulaire d'une
 *   ligne `owner` de l'amorcage.
 * - Une association garde au moins un compte capable (D3) : une
 *   retrogradation qui ferait tomber le decompte a zero est refusee.
 */

const BOARD_LEVEL_ROLES: MemberAccountRole[] = [
  MemberAccountRoleConst.MEMBER,
  MemberAccountRoleConst.BOARD,
]

const isAssignableRole = (value: string): value is MemberAccountRole =>
  (ASSIGNABLE_MEMBER_ROLES as readonly string[]).includes(value)

const actsAsPresident = (
  role: MemberAccountRole | null,
  isSuperAdmin: boolean
): boolean => !isSuperAdmin && role === MemberAccountRoleConst.OWNER

const isCapable = (role: MemberAccountRole): boolean =>
  role !== MemberAccountRoleConst.MEMBER

/** Decide l'ecriture d'un role, ou le refus motive. */
export const decideRoleChange = ({
  viewerRole,
  viewerIsSuperAdmin,
  targetRole,
  nextRole,
  isSelf,
  targetIsSuperAdmin,
  capableCount,
}: MemberRoleChangeInput): MemberRoleChangeDecision => {
  if (!isAssignableRole(nextRole)) {
    return {kind: 'refuse', reason: 'invalid_role'}
  }

  const president = actsAsPresident(viewerRole, viewerIsSuperAdmin)
  const touchesPresidency =
    targetRole === MemberAccountRoleConst.OWNER ||
    nextRole === MemberAccountRoleConst.OWNER

  if (!president && touchesPresidency) {
    return {kind: 'refuse', reason: 'presidency_reserved'}
  }
  if (president && isSelf) {
    return {kind: 'refuse', reason: 'own_presidency'}
  }
  if (nextRole === targetRole) return {kind: 'none'}
  if (nextRole === MemberAccountRoleConst.OWNER) {
    return {kind: 'transfer_presidency'}
  }
  if (nextRole === MemberAccountRoleConst.BOARD) return {kind: 'assign'}
  if (isCapable(targetRole) && !targetIsSuperAdmin && capableCount <= 1) {
    return {kind: 'refuse', reason: 'last_capable'}
  }
  return {kind: 'demote'}
}

/**
 * Carte « Role dans l'association » pour la personne connectee : la lecture,
 * le droit de modifier et les options du `radio-group`. `target.role` nul =
 * fiche sans compte, donc sans role possible.
 */
export const roleCardFor = (
  viewer: MemberRoleCardViewer,
  target: {role: MemberAccountRole | null}
): MemberRoleCardDTO => {
  const self = viewer.isSelf
  if (target.role === null) {
    return {
      reading: 'no_account',
      canEdit: false,
      notice: null,
      options: [],
      self,
    }
  }

  const president = actsAsPresident(viewer.role, viewer.isSuperAdmin)

  if (!president && target.role === MemberAccountRoleConst.OWNER) {
    return {
      reading: target.role,
      canEdit: false,
      notice: 'presidency_reserved',
      options: [],
      self,
    }
  }
  if (president && self) {
    return {
      reading: target.role,
      canEdit: false,
      notice: 'own_presidency',
      options: [],
      self,
    }
  }

  return {
    reading: target.role,
    canEdit: true,
    notice: null,
    options: president ? [...ASSIGNABLE_MEMBER_ROLES] : [...BOARD_LEVEL_ROLES],
    self,
  }
}

/**
 * Retrait d'une ligne `member` (ecran SuperAdmin, D2) : meme regle du dernier
 * compte capable qu'une retrogradation.
 */
export const decideMemberRemoval = ({
  targetRole,
  capableCount,
}: {
  targetRole: MemberAccountRole
  capableCount: number
}): {kind: 'remove'} | {kind: 'refuse'; reason: 'last_capable'} =>
  isCapable(targetRole) && capableCount <= 1
    ? {kind: 'refuse', reason: 'last_capable'}
    : {kind: 'remove'}
