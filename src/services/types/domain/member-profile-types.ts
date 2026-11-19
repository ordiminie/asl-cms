/**
 * Types de domaine des fiches de proprietaires (s12, ADR 029). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * A ne pas confondre avec `member` (Better Auth) : une fiche est une donnee
 * metier de l'association, qui existe sans compte. Une fiche dotee d'une
 * adresse a un compte (s12d, ADR 037).
 */

import {
  MemberEmailOrigin,
  MemberEmailRole,
  MemberEmailStatus,
} from './member-email-types'
import {MemberRoleCardDTO} from './member-role-types'

/** Taille de page de la liste du bureau, tableau comme cartes (decision I). */
export const MEMBER_PROFILES_PAGE_SIZE = 25

export const MEMBER_PROFILE_NAME_MAX_LENGTH = 200
export const MEMBER_PROFILE_ADDRESS_MAX_LENGTH = 200
export const MEMBER_PROFILE_CITY_MAX_LENGTH = 100
/** Libelle « nom de l'entreprise » (s55, ADR 058). */
export const MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH = 200
export const MEMBER_PROFILE_SEARCH_MAX_LENGTH = 100
/** Identifiant client Pennylane, cle d'import (s13, ADR 048). */
export const MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH = 100

/** Meme regle que le telephone d'un signalement (s10, decision H). */
export const MEMBER_PROFILE_PHONE_MAX_LENGTH = 30
export const MEMBER_PROFILE_PHONE_PATTERN = /^[0-9 +.\-()]+$/

/** Code postal : cinq chiffres (decision H). */
export const MEMBER_PROFILE_POSTAL_CODE_PATTERN = /^\d{5}$/

/**
 * Les coordonnees d'une fiche. `null` = absente, jamais une chaine vide.
 * `email` est l'adresse **titulaire active** (s54, ADR 056), lue dans
 * `member_profile_email`. Deux adresses postales typees (s55, ADR 058) : le
 * domicile (`home…`), adresse postale de la fiche, celle du courrier ; le
 * terrain (`land…`), propre a chaque fiche. `companyName` : libelle « nom de
 * l'entreprise », qui ne change rien d'autre.
 */
export type MemberProfileContact = {
  email: string | null
  phone: string | null
  homeAddressLine: string | null
  homeAddressComplement: string | null
  homePostalCode: string | null
  homeCity: string | null
  landAddressLine: string | null
  landAddressComplement: string | null
  landPostalCode: string | null
  landCity: string | null
  companyName: string | null
}

/** Les champs d'une fiche, sans l'etat de son compte. */
export type MemberProfileFieldsDTO = MemberProfileContact & {
  /** UUID genere par la base : la seule identite d'un proprietaire. */
  id: string
  organizationId: string
  name: string
  /** Courrier uniquement : aucune adresse active (ADR 056 §2). */
  mailOnly: boolean
  /** Courrier uniquement et aucune adresse de domicile (decision G, s55). */
  incomplete: boolean
}

/**
 * L'etat du compte de l'adresse **titulaire** d'une fiche, tel que le bureau
 * le lit (s12d, carte « Acces a l'espace membre », reduite en s54) : ouvert,
 * avec l'adresse de connexion et le role au bureau eventuel, ou courrier
 * uniquement. Chaque adresse active porte en plus son propre compte
 * (`MemberProfileEmailDTO`).
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

/**
 * Une adresse d'une fiche, telle que le bureau la lit (s54, design 4a) : role,
 * statut, origine, auteur et echeance d'une attente ; pour une adresse
 * active, le role au bureau et les autres fiches de son compte.
 */
export type MemberProfileEmailDTO = {
  id: string
  email: string
  role: MemberEmailRole
  status: MemberEmailStatus
  origin: MemberEmailOrigin
  /** Nom de la personne qui l'a ajoutee depuis son espace ; nul sinon. */
  addedByName: string | null
  /** Echeance d'une adresse en attente (ISO) ; nulle pour une active. */
  expiresAt: string | null
  /** Une modification en attente remplacera cette adresse ; nul sinon. */
  replacesEmailId: string | null
  boardRole: 'board' | 'owner' | null
  /** Les autres fiches reliees au compte de l'adresse (s53, 3c). */
  otherProfiles: MemberAccountProfileDTO[]
}

export type MemberProfileDTO = MemberProfileFieldsDTO & {
  /**
   * L'identifiant client Pennylane de la fiche (s20, critere 4) : la cle de
   * rapprochement de ses factures (ADR 062 §2) ; nul sans lui.
   */
  pennylaneCustomerId: string | null
  /** Les adresses de la fiche, titulaire d'abord (s54). */
  emails: MemberProfileEmailDTO[]
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
  /** Nombre de fiches que porte le compte titulaire ; 0 sans compte (s53). */
  accountProfileCount: number
  /** Adresses actives de la fiche autres que la titulaire (s54, 5a). */
  otherEmailCount: number
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

/**
 * Ce que le bureau saisit dans « Coordonnees ». Une chaine vide vaut une
 * coordonnee absente. Sans email depuis s54 : les adresses ont leur carte.
 */
export type MemberProfileContactInput = {
  phone?: string
  homeAddressLine?: string
  homeAddressComplement?: string
  homePostalCode?: string
  homeCity?: string
  landAddressLine?: string
  landAddressComplement?: string
  landPostalCode?: string
  landCity?: string
  companyName?: string
}

export type CreateMemberProfileInput = MemberProfileContactInput & {
  organizationId: string
  name: string
  /** L'adresse saisie a la creation : la titulaire de la fiche (s54). */
  email?: string
  /**
   * Le compte que le bureau a confirme rejoindre quand l'adresse est deja la
   * sienne (s53, ADR 054 §4) : revérifie au serveur, jamais cru tel quel.
   */
  confirmedAccountUserId?: string
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
  /** Le filtre « Groupe » de la liste (s27). */
  groupId?: string
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

/** Le bureau ajoute une adresse a une fiche (s54, 4b-4c). */
export type AddMemberProfileEmailInput = {
  organizationId: string
  memberProfileId: string
  email: string
  /** Le role choisi quand l'adresse est deja portee ailleurs (critere 8). */
  role?: MemberEmailRole
  /** Le compte confirme (s53, ADR 054 §4), revérifie au serveur. */
  confirmedAccountUserId?: string
  /** `file` pour l'import (s13) ; `site` par defaut. */
  origin?: MemberEmailOrigin
}

/** Le bureau modifie une adresse d'une fiche (s54, 4 « Gerer »). */
export type UpdateMemberProfileEmailInput = {
  organizationId: string
  memberProfileId: string
  emailId: string
  email: string
  confirmedAccountUserId?: string
}

/** Le bureau retire une adresse, avec la remplacante de la titulaire (4e). */
export type RemoveMemberProfileEmailInput = {
  organizationId: string
  memberProfileId: string
  emailId: string
  /** Adresse active existante qui prend le titre. */
  replacementEmailId?: string
  /** Nouvelle adresse saisie qui devient titulaire. */
  replacementEmail?: string
}

/** Le bureau designe une adresse active comme titulaire (4d). */
export type DesignateMemberProfileHolderInput = {
  organizationId: string
  memberProfileId: string
  emailId: string
}

/** Ce qu'une ecriture d'adresse par le bureau a fait (4g). */
export type MemberProfileEmailChange =
  'added' | 'updated' | 'removed' | 'designated'

export type MemberProfileEmailWriteResult =
  | {
      status: 'saved'
      profile: MemberProfileDTO
      change: MemberProfileEmailChange
      /** L'adresse ecrite, pour les messages de confirmation (4g). */
      email: string
    }
  | {status: 'email_shared'; holder: MemberAccountHolderDTO}
  | {status: 'not_found'}
  /** L'adresse figure deja sur la fiche. */
  | {status: 'already_listed'}
  /** Retirer la titulaire exige une remplacante (critere 9). */
  | {status: 'replacement_required'}
  | {status: 'invalid_replacement'}
  /** L'adresse d'un membre du bureau sur sa derniere fiche (s12d). */
  | {status: 'board_email_required'}

/** Ce que le bureau saisit dans la carte « Facturation » (s20, critere 4). */
export type UpdateMemberProfilePennylaneIdInput = {
  organizationId: string
  memberProfileId: string
  /** Vide : l'identifiant est retire. */
  pennylaneCustomerId: string
}

export type UpdateMemberProfilePennylaneIdResult =
  | {status: 'saved'}
  | {status: 'not_found'}
  /** Deja porte par une autre fiche de l'association : rien n'est ecrit. */
  | {status: 'pennylane_id_taken'; holderName: string}
