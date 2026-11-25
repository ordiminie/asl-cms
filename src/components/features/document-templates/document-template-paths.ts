import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'

/** Chemins du back-office des modeles de documents (s36). */
export const DOCUMENT_TEMPLATES_PATH = '/bureau/modeles-documents'
export const NEW_DOCUMENT_TEMPLATE_PATH = `${DOCUMENT_TEMPLATES_PATH}/nouveau`
export const DOCUMENT_LOT_PATH = `${DOCUMENT_TEMPLATES_PATH}/lot`

export const documentTemplatePathOf = (templateId: string): string =>
  `${DOCUMENT_TEMPLATES_PATH}/${encodeURIComponent(templateId)}`

/** Le lot, modele preselectionne par `?modele=` quand il est connu. */
export const documentLotPathOf = (templateId?: string): string =>
  templateId
    ? `${DOCUMENT_LOT_PATH}?modele=${encodeURIComponent(templateId)}`
    : DOCUMENT_LOT_PATH

/** Le drapeau d'un modele enregistre (2d) et d'un modele supprime (1e). */
export const DOCUMENT_TEMPLATE_NOTICE_FLAG = '1'

/** L'editeur apres un enregistrement : un drapeau, jamais le nom. */
export const savedDocumentTemplatePathOf = (templateId: string): string =>
  `${documentTemplatePathOf(templateId)}?enregistre=${DOCUMENT_TEMPLATE_NOTICE_FLAG}`

/** La liste apres une suppression : un drapeau, jamais le nom. */
export const DELETED_DOCUMENT_TEMPLATE_PATH = `${DOCUMENT_TEMPLATES_PATH}?supprime=${DOCUMENT_TEMPLATE_NOTICE_FLAG}`

/** Motif de route a revalider apres une modification d'un modele. */
export const DOCUMENT_TEMPLATES_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/modeles-documents'

/** Generer un document pour une fiche, sous-route de la fiche (ecran 3). */
export const generateDocumentPathOf = (memberProfileId: string): string =>
  `${memberProfilePathOf(memberProfileId)}/documents/generer`

/**
 * La route qui produit le document d'une fiche, en memoire (critere 2) : le
 * modele, la fiche et la date choisie. Rien n'est stocke.
 */
export const templateDocumentDownloadPathOf = (
  templateId: string,
  memberProfileId: string,
  documentDate: string
): string => {
  const query = new URLSearchParams({
    fiche: memberProfileId,
    date: documentDate,
  })
  return `/api/document-templates/${encodeURIComponent(templateId)}/document?${query.toString()}`
}
