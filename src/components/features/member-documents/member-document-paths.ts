import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'

/** Chemins du back-office des documents nominatifs (s32). */
export const MEMBER_DOCUMENTS_PATH = '/bureau/documents-nominatifs'
export const MEMBER_DOCUMENT_BATCH_PATH = `${MEMBER_DOCUMENTS_PATH}/lot`
export const MEMBER_DOCUMENT_CATEGORIES_PATH = `${MEMBER_DOCUMENTS_PATH}/categories`

/**
 * L'adresse de la vue d'ensemble pour une page, une recherche et une
 * categorie : les filtres voyagent dans l'URL (`q`, `categorie`) et la
 * pagination les conserve.
 */
export const memberDocumentsListPathOf = (input: {
  page?: number
  search?: string
  categoryId?: string
}): string => {
  const params = new URLSearchParams()
  if (input.search) params.set('q', input.search)
  if (input.categoryId) params.set('categorie', input.categoryId)
  if (input.page && input.page > 1) params.set('page', String(input.page))

  const query = params.toString()
  return query ? `${MEMBER_DOCUMENTS_PATH}?${query}` : MEMBER_DOCUMENTS_PATH
}

/** Le depot unitaire, sous-route de la fiche (patron `factures/nouvelle`). */
export const newMemberDocumentPathOf = (memberProfileId: string): string =>
  `${memberProfilePathOf(memberProfileId)}/documents/nouveau`

/**
 * Route authentifiee qui sert le fichier d'un document **par son
 * identifiant** (ADR 073 §5). Jamais un chemin de stockage.
 */
export const memberDocumentDownloadPathOf = (documentId: string): string =>
  `/api/member-documents/${encodeURIComponent(documentId)}`

/** `?documents=` pose sur la fiche, `?statut=` sur la vue d'ensemble. */
export const MemberDocumentNoticeParamConst = {
  DEPOSITED: 'depose',
  REMOVED: 'retire',
} as const

export type MemberDocumentNotice =
  {kind: 'deposited'; documentId?: string} | {kind: 'removed'}

/** L'alerte d'arrivee lue dans l'URL, ou rien. */
export const memberDocumentNoticeOf = (
  value?: string,
  documentId?: string
): MemberDocumentNotice | undefined => {
  if (value === MemberDocumentNoticeParamConst.DEPOSITED) {
    return {kind: 'deposited', documentId}
  }
  if (value === MemberDocumentNoticeParamConst.REMOVED) return {kind: 'removed'}
  return undefined
}

/** D'ou vient un retrait : la fiche, ou la vue d'ensemble. */
export type MemberDocumentRemovalOrigin = 'profile' | 'overview'

/**
 * Motifs de route (arborescence de fichiers) a revalider apres une ecriture :
 * la fiche (et ses sous-routes), la vue d'ensemble et l'espace membre.
 */
export const MEMBER_PROFILE_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/proprietaires/[id]'
export const MEMBER_DOCUMENTS_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/documents-nominatifs'
export const MEMBER_SPACE_ROUTE_PATTERN = '/[locale]/(app)/dashboard'
