/**
 * Types de domaine des fiches de proprietaires (s12, ADR 029). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * A ne pas confondre avec `member` (Better Auth) : une fiche est une donnee
 * metier de l'association, qui existe sans compte. Une fiche dotee d'une
 * adresse a un compte (s12d, ADR 037).
 */

import {MemberRoleCardDTO} from './member-role-types'

/** Taille de page de la liste du bureau, tableau comme cartes (decision I). */
export const MEMBER_PROFILES_PAGE_SIZE = 25

export const MEMBER_PROFILE_NAME_MAX_LENGTH = 200
export const MEMBER_PROFILE_ADDRESS_MAX_LENGTH = 200
export const MEMBER_PROFILE_CITY_MAX_LENGTH = 100
export const MEMBER_PROFILE_SEARCH_MAX_LENGTH = 100
/** Identifiant client Pennylane, cle d'import (s13, ADR 048). */
export const MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH = 100

/** Meme regle que le telephone d'un signalement (s10, decision H). */
export const MEMBER_PROFILE_PHONE_MAX_LENGTH = 30
export const MEMBER_PROFILE_PHONE_PATTERN = /^[0-9 +.\-()]+$/

/** Code postal : cinq chiffres (decision H). */
export const MEMBER_PROFILE_POSTAL_CODE_PATTERN = /^\d{5}$/

/** Les coordonnees d'une fiche. `null` = absente, jamais une chaine vide. */
export type MemberProfileContact = {
  email: string | null
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

/** Les champs d'une fiche, sans l'etat de son compte. */
export type MemberProfileFieldsDTO = MemberProfileContact & {
  /** UUID genere par la base : la seule identite d'un proprietaire. */
  id: string
  organizationId: string
  name: string
  /** Joignable par courrier uniquement : colonne generee, `email IS NULL`. */
  mailOnly: boolean
  /** Courrier uniquement et aucune adresse postale (decision G). */
  incomplete: boolean
}

/**
 * L'etat du compte d'une fiche, tel que le bureau le lit (s12d, carte
 * « Acces a l'espace membre ») : ouvert, avec l'adresse de connexion et le
 * role au bureau eventuel, ou courrier uniquement.
 */
export type MemberProfileAccountDTO =
  | {
      status: 'open'
      loginEmail: string
      boardRole: 'board' | 'owner' | null
      /** Nom du compte (`user.name`), pas celui de la fiche (s53). */
      accountName: string
      /** Les autres fiches reliees au meme compte (s53, design 3c). */
      otherProfiles: MemberAccountProfileDTO[]
    }
  | {status: 'mail_only'}

/** Une fiche d'un compte, designee pour le bureau (s53). */
export type MemberAccountProfileDTO = {
  id: string
  name: string
  /** Numeros des parcelles actuelles, en ordre numerique. */
  parcelNumbers: string[]
}

/**
 * Le compte qui porte deja l'adresse saisie (s53, ADR 054 §4) : son
 * identifiant, que le second envoi renvoie pour confirmer, son nom et ses
 * fiches.
 */
export type MemberAccountHolderDTO = {
  userId: string
  name: string
  profiles: MemberAccountProfileDTO[]
}

export type MemberProfileDTO = MemberProfileFieldsDTO & {
  account: MemberProfileAccountDTO
  /**
   * Carte « Role dans l'association » (s14), calculee pour la personne
   * connectee : lecture, droit de modifier, options.
   */
  roleCard: MemberRoleCardDTO
}

/**
 * Une ligne de la liste : la fiche, les numeros de ses parcelles actuelles et
 * le role au bureau de son compte (badge, s14).
 */
export type MemberProfileListItemDTO = MemberProfileFieldsDTO & {
  currentParcelNumbers: string[]
  boardRole: 'board' | 'owner' | null
  /** Nombre de fiches que porte le compte de la fiche ; 0 sans compte (s53). */
  accountProfileCount: number
}

export type MemberProfilePageDTO = {
  items: MemberProfileListItemDTO[]
  page: number
  pageSize: number
  /** Nombre de fiches qui repondent a la recherche. */
  total: number
  totalPages: number
  /** Nombre de fiches de l'association, recherche ignoree. */
  profileCount: number
  /** Nombre de fiches incompletes de l'association, recherche ignoree. */
  incompleteCount: number
}

/** Ce que le bureau saisit. Une chaine vide vaut une coordonnee absente. */
export type MemberProfileContactInput = {
  /**
   * Le compte que le bureau a confirme rejoindre quand l'adresse est deja la
   * sienne (s53, ADR 054 §4) : revérifie au serveur, jamais cru tel quel.
   */
  confirmedAccountUserId?: string
  email?: string
  phone?: string
  addressLine?: string
  addressComplement?: string
  postalCode?: string
  city?: string
}

export type CreateMemberProfileInput = MemberProfileContactInput & {
  organizationId: string
  name: string
  /** Cle d'import Pennylane (s13, ADR 048) : ecrite par l'import seul. */
  pennylaneCustomerId?: string
}

export type UpdateMemberProfileContactInput = MemberProfileContactInput & {
  organizationId: string
  memberProfileId: string
}

export type MemberProfilePageInput = {
  organizationId: string
  page: number
  search?: string
}

/**
 * Resultat d'une ecriture. `email_shared` : l'adresse est deja celle d'un
 * compte de l'association ; rien n'est ecrit, le bureau confirme (s53, 3a).
 */
export type MemberProfileWriteResult =
  | {
      status: 'saved'
      profile: MemberProfileDTO
      /** Ce que l'enregistrement a fait du compte (s12d). */
      accountChange: MemberAccountChange
    }
  | {status: 'email_shared'; holder: MemberAccountHolderDTO}
  | {status: 'not_found'}
  /** Vider l'adresse d'un membre du bureau : refuse, rien n'est ecrit (s12d). */
  | {status: 'board_email_required'}

/**
 * Ce que l'enregistrement d'une fiche a fait de son compte (s12d) : pour les
 * messages de l'ecran. `null` quand l'acces ne change pas.
 */
export type MemberAccountChange =
  | 'opened'
  | 'closed'
  | 'replaced'
  /** La fiche a rejoint le compte qui portait deja son adresse (s53). */
  | 'linked'
  | null
