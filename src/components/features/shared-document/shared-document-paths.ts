/** Chemins du back-office des documents partages (s31). */
export const SHARED_DOCUMENTS_PATH = '/bureau/documents'
export const NEW_SHARED_DOCUMENT_PATH = `${SHARED_DOCUMENTS_PATH}/nouveau`
export const SHARED_DOCUMENT_CATEGORIES_PATH = `${SHARED_DOCUMENTS_PATH}/categories`

/**
 * Route authentifiee qui sert le fichier d'un document **par son
 * identifiant** (ADR 069 §4). Jamais un chemin de stockage.
 */
export const sharedDocumentDownloadPathOf = (documentId: string): string =>
  `/api/documents/${encodeURIComponent(documentId)}`

/** `?statut=` pose par les Server Actions apres un succes. */
export const SharedDocumentNoticeParamConst = {
  PUBLISHED: 'depose',
  DELETED: 'retire',
} as const

/**
 * Motifs de route (arborescence de fichiers) a revalider apres une ecriture :
 * le segment du back-office — liste, depot et categories, en `layout` — et
 * l'espace membre, qui liste les documents.
 */
export const SHARED_DOCUMENTS_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/documents'
export const MEMBER_SPACE_ROUTE_PATTERN = '/[locale]/(app)/dashboard'
