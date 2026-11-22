/**
 * Types de domaine des documents partages (s31, ADR 069). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * Un document partage est publie par le bureau a tous les membres
 * authentifies de son association. Sa cle de stockage n'apparait dans aucun
 * DTO : la presentation ne connait que l'identifiant, servi par la route
 * authentifiee `GET /api/documents/{id}`.
 */

/** Un document tel que le lit un membre dans son espace. */
export type SharedDocumentDTO = {
  id: string
  title: string
  /** Nom de la categorie, garde meme si elle a ete supprimee depuis. */
  categoryName: string
  /** Poids du PDF, annonce a cote du lien de telechargement. */
  fileBytes: number
  createdAt: Date
}

/** Un document tel que le gere le bureau. */
export type BureauSharedDocumentDTO = SharedDocumentDTO & {
  categoryId: string
}

/** Longueur maximale du titre, apres `trim`. */
export const SHARED_DOCUMENT_TITLE_MAX_LENGTH = 120

/**
 * Prefixe de stockage des documents partages. **Pas** une portee de
 * `CONTENT_FILE_SCOPES` : la route publique `/api/files` refuse ces cles
 * (ADR 069 §3).
 */
export const SHARED_DOCUMENT_KEY_PREFIX = 'shared-documents'

/** Emplacement unique du fichier dans le document. */
const SHARED_DOCUMENT_FILE_SLOT = 'file'

/**
 * Codes de refus d'un depot. Un refus n'ecrit **rien** : ni fichier, ni
 * ligne.
 */
export const SharedDocumentIssueConst = {
  TITLE_MISSING: 'title_missing',
  TITLE_TOO_LONG: 'title_too_long',
  CATEGORY_MISSING: 'category_missing',
  /** Categorie inconnue, supprimee, ou d'un autre domaine. */
  CATEGORY_UNAVAILABLE: 'category_unavailable',
  FILE_MISSING: 'file_missing',
  FILE_FORMAT: 'file_format',
  FILE_SIZE: 'file_size',
} as const

export type SharedDocumentIssue =
  (typeof SharedDocumentIssueConst)[keyof typeof SharedDocumentIssueConst]

export type SharedDocumentPublishResult =
  | {status: 'published'; document: BureauSharedDocumentDTO}
  | {status: 'rejected'; issues: SharedDocumentIssue[]}

export type SharedDocumentDeleteResult = {status: 'deleted'; title: string}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Cle de stockage generee par le serveur :
 * `{organizationId}/shared-documents/{documentId}/file-{uuid}.pdf`.
 */
export const buildSharedDocumentFileKey = (
  organizationId: string,
  documentId: string
): string => {
  if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(documentId)) {
    throw new Error('Invalid identifier for a shared document key')
  }

  return `${organizationId}/${SHARED_DOCUMENT_KEY_PREFIX}/${documentId}/${SHARED_DOCUMENT_FILE_SLOT}-${crypto.randomUUID()}.pdf`
}

const DOWNLOAD_NAME_MAX_LENGTH = 80
const DEFAULT_DOWNLOAD_NAME = 'document'

/**
 * Nom propose au telechargement, tire du titre en **ASCII seul** : sans
 * accent, sans guillemet ni barre ni retour a la ligne, qui casseraient
 * l'en-tete `Content-Disposition`. Jamais le nom du fichier depose.
 */
export const sharedDocumentDownloadName = (title: string): string => {
  const ascii = title
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^A-Za-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, DOWNLOAD_NAME_MAX_LENGTH)
    .replace(/-+$/, '')

  return `${ascii || DEFAULT_DOWNLOAD_NAME}.pdf`
}
