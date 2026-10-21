/**
 * Types de domaine des fiches de proprietaires (s12, ADR 029). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * A ne pas confondre avec `member` (Better Auth) : une fiche est une donnee
 * metier de l'association, qui existe sans compte. Une fiche dotee d'une
 * adresse a un compte (s12d, ADR 037).
 */

/** Taille de page de la liste du bureau, tableau comme cartes (decision I). */
export const MEMBER_PROFILES_PAGE_SIZE = 25

export const MEMBER_PROFILE_NAME_MAX_LENGTH = 200
export const MEMBER_PROFILE_ADDRESS_MAX_LENGTH = 200
export const MEMBER_PROFILE_CITY_MAX_LENGTH = 100
export const MEMBER_PROFILE_SEARCH_MAX_LENGTH = 100

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
  | {status: 'open'; loginEmail: string; boardRole: 'board' | 'owner' | null}
  | {status: 'mail_only'}

export type MemberProfileDTO = MemberProfileFieldsDTO & {
  account: MemberProfileAccountDTO
}

/** Une ligne de la liste : la fiche et les numeros de ses parcelles actuelles. */
export type MemberProfileListItemDTO = MemberProfileFieldsDTO & {
  currentParcelNumbers: string[]
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
 * Resultat d'une ecriture. `email_taken` porte l'identifiant de la fiche qui
 * detient deja l'adresse, pour que l'ecran y renvoie (design `2e`).
 */
export type MemberProfileWriteResult =
  | {
      status: 'saved'
      profile: MemberProfileDTO
      /** Ce que l'enregistrement a fait du compte (s12d). */
      accountChange: MemberAccountChange
    }
  | {status: 'email_taken'; memberProfileId: string}
  | {status: 'not_found'}
  /** Vider l'adresse d'un membre du bureau : refuse, rien n'est ecrit (s12d). */
  | {status: 'board_email_required'}

/**
 * Ce que l'enregistrement d'une fiche a fait de son compte (s12d) : pour les
 * messages de l'ecran. `null` quand l'acces ne change pas.
 */
export type MemberAccountChange = 'opened' | 'closed' | 'replaced' | null
