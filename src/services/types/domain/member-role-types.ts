/**
 * Types de domaine du changement de role d'association (s14, ADR 039).
 * Ecrits sans importer le modele Drizzle (`rule-architecture`).
 *
 * Trois roles seulement : Membre (`member`), Bureau (`board`),
 * President(e) (`owner`). Le SuperAdmin n'est pas un role d'association et
 * n'est jamais attribuable (critere 6).
 */
import {MemberAccountRole} from './member-account-types'

export const ASSIGNABLE_MEMBER_ROLES = [
  'member',
  'board',
  'owner',
] as const satisfies readonly MemberAccountRole[]

export type MemberRoleChangeInput = {
  /** Role, dans l'association, de la personne connectee ; `null` sans ligne. */
  viewerRole: MemberAccountRole | null
  /** Le SuperAdmin agit comme un membre du Bureau, jamais comme President(e). */
  viewerIsSuperAdmin: boolean
  /** Role enregistre du compte de la fiche. */
  targetRole: MemberAccountRole
  /** Role demande ; une chaine quelconque, venue du navigateur. */
  nextRole: string
  /** La personne connectee modifie sa propre fiche. */
  isSelf: boolean
  /** Comptes capables d'attribuer les roles, lus sous verrou (D3). */
  capableCount: number
}

export type MemberRoleRefusal =
  'presidency_reserved' | 'own_presidency' | 'last_capable' | 'invalid_role'

/** Ce que l'enregistrement d'un role fait. */
export type MemberRoleChangeDecision =
  | {kind: 'none'}
  | {kind: 'assign'}
  | {kind: 'demote'}
  | {kind: 'transfer_presidency'}
  | {kind: 'refuse'; reason: MemberRoleRefusal}

/** Lecture de la carte « Role dans l'association » (ecran A). */
export type MemberRoleReading = MemberAccountRole | 'no_account'

/** Phrase affichee a la place du bouton quand la carte n'est pas modifiable. */
export type MemberRoleCardNotice = 'presidency_reserved' | 'own_presidency'

export type MemberRoleCardDTO = {
  reading: MemberRoleReading
  canEdit: boolean
  notice: MemberRoleCardNotice | null
  /** Options du `radio-group`, dans l'ordre d'affichage. */
  options: MemberAccountRole[]
  /** La fiche est celle de la personne connectee (textes a la 2e personne). */
  self: boolean
}

export type MemberRoleCardViewer = {
  role: MemberAccountRole | null
  isSuperAdmin: boolean
  isSelf: boolean
}

/** Ce que l'ecran envoie. `role` reste une chaine : la regle refuse le reste. */
export type ChangeMemberRoleInput = {
  organizationId: string
  memberProfileId: string
  role: string
}

export type MemberRoleChangeKind =
  'none' | 'assigned' | 'demoted' | 'presidency_transferred'

/**
 * Resultat d'un changement de role. `name` est celui de la fiche, `self` dit
 * que la personne connectee a change son propre role.
 */
export type MemberRoleChangeResult =
  | {status: 'not_found'}
  | {status: 'no_account'}
  | {
      status: 'saved'
      change: MemberRoleChangeKind
      self: boolean
      name: string
    }
  | {
      status: 'refused'
      reason: MemberRoleRefusal
      self: boolean
      name: string
    }

/** Recours d'exploitation (D8) : la passation par `pnpm ops:transfer-presidency`. */
export type TransferPresidencyByOperatorResult = {
  organizationId: string
  newOwnerUserId: string
  previousOwnerUserId: string | null
  changed: boolean
}
