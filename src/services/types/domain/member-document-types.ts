import {sharedDocumentDownloadName} from './shared-document-types'

/**
 * Types de domaine des documents nominatifs (s32, ADR 073). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * Un document nominatif appartient a **une fiche** (`member_profile`), jamais
 * a un compte : une fiche sans compte a son dossier. Sa cle de stockage
 * n'apparait dans aucun DTO : la presentation ne connait que l'identifiant,
 * servi par la route authentifiee `GET /api/member-documents/{id}`.
 */

/** Le terrain d'un document, dans le vocabulaire de « Mes factures ». */
export type MemberDocumentTerrain = {
  /** Les parcelles de la fiche a la date du document. */
  parcelNumbers: string[]
  meterNumber: string | null
  /** Le nom de la fiche quand il n'est pas celui du compte. */
  holderName: string | null
}

/** Un document tel que le lit un membre dans son espace. */
export type MyMemberDocumentDTO = MemberDocumentTerrain & {
  id: string
  title: string
  /** Nom de la categorie, garde meme si elle a ete supprimee depuis. */
  categoryName: string
  /** Date ecrite sur le document (`aaaa-mm-jj`), saisie par le bureau. */
  documentDate: string
  /** Poids du PDF, annonce a cote du lien de telechargement. */
  fileBytes: number
}

/** Un document tel que le gere le bureau, avec sa fiche. */
export type BureauMemberDocumentDTO = {
  id: string
  title: string
  categoryId: string
  categoryName: string
  documentDate: string
  fileBytes: number
  createdAt: Date
  memberProfileId: string
  memberProfileName: string
}

/** Une page de la liste du bureau, paginee cote serveur. */
export type BureauMemberDocumentPageDTO = {
  documents: BureauMemberDocumentDTO[]
  total: number
  page: number
  pageSize: number
  /** Decompte par categorie, sur toute l'association (filtre du tableau). */
  countsByCategory: Record<string, number>
  /** Les parcelles actuelles de chaque fiche de la page (colonne « Fiche »). */
  parcelNumbersByProfile: Record<string, string[]>
}

/** Les fiches qu'un lot peut atteindre, ou non (design s32, 5d et 5e). */
export type MemberDocumentBatchReachDTO = {
  profilesWithReference: number
  profilesWithoutReference: number
}

/** Longueur maximale du titre, apres `trim`. */
export const MEMBER_DOCUMENT_TITLE_MAX_LENGTH = 120

/** Lignes par page de la liste du bureau. */
export const MEMBER_DOCUMENT_PAGE_SIZE = 25

/**
 * Prefixe de stockage des documents nominatifs. **Pas** une portee de
 * `CONTENT_FILE_SCOPES` : la route publique `/api/files` refuse ces cles
 * (ADR 073 §2).
 */
export const MEMBER_DOCUMENT_KEY_PREFIX = 'member-documents'

/**
 * Codes de refus d'un depot. Un refus n'ecrit **rien** : ni fichier, ni
 * ligne.
 */
export const MemberDocumentIssueConst = {
  TITLE_MISSING: 'title_missing',
  TITLE_TOO_LONG: 'title_too_long',
  CATEGORY_MISSING: 'category_missing',
  /** Categorie inconnue, supprimee, ou d'un autre domaine. */
  CATEGORY_UNAVAILABLE: 'category_unavailable',
  DATE_INVALID: 'date_invalid',
  FILE_MISSING: 'file_missing',
  FILE_FORMAT: 'file_format',
  FILE_SIZE: 'file_size',
} as const

export type MemberDocumentIssue =
  (typeof MemberDocumentIssueConst)[keyof typeof MemberDocumentIssueConst]

export type MemberDocumentDepositResult =
  | {status: 'deposited'; document: BureauMemberDocumentDTO}
  | {status: 'rejected'; issues: MemberDocumentIssue[]}

export type MemberDocumentRemoveResult = {
  status: 'removed'
  title: string
  memberProfileId: string
}

/** Raisons d'ecarter une ligne d'un lot (ADR 073 §8). */
export const MemberDocumentBatchRejectionConst = {
  NO_REFERENCE_IN_NAME: 'no_reference_in_name',
  UNKNOWN_REFERENCE: 'unknown_reference',
  INVALID_FILE: 'invalid_file',
  TOO_LARGE: 'too_large',
  INVALID_INPUT: 'invalid_input',
} as const

export type MemberDocumentBatchRejection =
  (typeof MemberDocumentBatchRejectionConst)[keyof typeof MemberDocumentBatchRejectionConst]

/**
 * Le resultat d'une ligne de lot : deposee sur **la** fiche dont la reference
 * ouvre le nom du fichier, ou ecartee avec sa raison — jamais une fiche par
 * defaut.
 */
export type MemberDocumentBatchLineResult =
  | {
      status: 'deposited'
      fileName: string
      memberProfileId: string
      memberProfileName: string
      parcelNumbers: string[]
      meterNumber: string | null
    }
  | {
      status: 'rejected'
      fileName: string
      reason: MemberDocumentBatchRejection
      /** La reference lue dans le nom, quand il en porte une. */
      reference?: string
    }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const UUID_SOURCE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** Le seul nom de fichier qu'un dossier de fiche contient. */
const MEMBER_DOCUMENT_FILE_NAME_PATTERN = new RegExp(
  `^${UUID_SOURCE}-${UUID_SOURCE}\\.pdf$`,
  'i'
)

const requireUuids = (...identifiers: string[]): void => {
  if (identifiers.some((identifier) => !UUID_PATTERN.test(identifier))) {
    throw new Error('Invalid identifier for a member document key')
  }
}

/**
 * Le dossier d'une fiche : `{organizationId}/member-documents/{profileId}`.
 * C'est le `basePath` du stockage ouvert sur cette fiche (ADR 073 §3).
 */
export const memberDocumentFolderOf = (
  organizationId: string,
  memberProfileId: string
): string => {
  requireUuids(organizationId, memberProfileId)
  return `${organizationId}/${MEMBER_DOCUMENT_KEY_PREFIX}/${memberProfileId}`
}

/**
 * Cle de stockage generee par le serveur :
 * `{organizationId}/member-documents/{profileId}/{documentId}-{uuid}.pdf`.
 */
export const buildMemberDocumentFileKey = (
  organizationId: string,
  memberProfileId: string,
  documentId: string
): string => {
  requireUuids(organizationId, memberProfileId, documentId)
  return `${memberDocumentFolderOf(organizationId, memberProfileId)}/${documentId}-${crypto.randomUUID()}.pdf`
}

/**
 * La cle vit-elle **dans le dossier de cette fiche**, sous un nom de fichier
 * sans separateur (ADR 073 §4.3) ? Le nom doit avoir la forme exacte que
 * genere le serveur : un `..`, un `%2F`, une barre inverse ou un octet nul
 * n'y passent pas.
 */
export const isMemberDocumentKeyOf = (
  key: string,
  organizationId: string,
  memberProfileId: string
): boolean => {
  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(memberProfileId)
  ) {
    return false
  }

  const folder = `${memberDocumentFolderOf(organizationId, memberProfileId)}/`
  if (!key.startsWith(folder)) return false

  return MEMBER_DOCUMENT_FILE_NAME_PATTERN.test(key.slice(folder.length))
}

/**
 * Nom propose au telechargement, tire du titre en **ASCII seul**. Meme regle
 * que les documents partages : une seule implementation.
 */
export const memberDocumentDownloadName = (title: string): string =>
  sharedDocumentDownloadName(title)
