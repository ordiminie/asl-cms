import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_VARIABLES,
  CampaignTarget,
} from './campaign-types'
import {
  MemberDocumentDepositResult,
  MemberDocumentIssue,
} from './member-document-types'

/**
 * Types de domaine des modeles de documents (s36, ADR 074). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * Le contenu d'un modele n'est pas nominatif ; un document produit l'est :
 * jamais dans un journal, jamais dans un `'use cache'`, jamais dans un nom
 * de fichier.
 */

/**
 * Les variables propres aux documents (ADR 074 §2) : `{association}`, le nom
 * affiche de l'association. Absentes des campagnes email.
 */
export const DOCUMENT_TEMPLATE_EXTRA_VARIABLES = ['association'] as const
export type DocumentTemplateExtraVariable =
  (typeof DOCUMENT_TEMPLATE_EXTRA_VARIABLES)[number]

/** Les quatre variables d'un document : `{nom}` `{parcelle}` `{date}` `{association}`. */
export const DOCUMENT_TEMPLATE_VARIABLES = [
  ...CAMPAIGN_VARIABLES,
  ...DOCUMENT_TEMPLATE_EXTRA_VARIABLES,
] as const
export type DocumentTemplateVariable =
  (typeof DOCUMENT_TEMPLATE_VARIABLES)[number]

/** Longueur maximale du nom interne, apres `trim`. */
export const DOCUMENT_TEMPLATE_NAME_MAX_LENGTH = 80

/** Longueur maximale de l'objet imprime, apres `trim`. */
export const DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH = 150

/** Longueur maximale du texte, celle du corps d'une campagne. */
export const DOCUMENT_TEMPLATE_BODY_MAX_LENGTH = CAMPAIGN_BODY_MAX

/** Un modele dans la liste du bureau. */
export type DocumentTemplateListItemDTO = {
  id: string
  name: string
  /** Les variables connues que le modele emploie, dans l'ordre des quatre. */
  variables: DocumentTemplateVariable[]
  updatedAt: Date
}

/** Un modele tel que l'edite le bureau. */
export type DocumentTemplateDTO = {
  id: string
  name: string
  subject: string
  bodyMarkdown: string
  updatedAt: Date
}

/** Les champs d'un modele, tels que saisis. */
export type DocumentTemplateFields = {
  name: string
  subject: string
  bodyMarkdown: string
}

export type DocumentTemplateField = keyof DocumentTemplateFields

/** Un refus de champ : manquant, trop long, ou variables inconnues nommees. */
export type DocumentTemplateFieldIssue =
  | {code: 'missing'}
  | {code: 'tooLong'; max: number}
  | {code: 'unknownVariables'; variables: string[]}

export type DocumentTemplateIssues = Partial<
  Record<DocumentTemplateField, DocumentTemplateFieldIssue>
>

/** Un refus n'ecrit **rien**. */
export type DocumentTemplateSaveResult =
  | {status: 'saved'; template: DocumentTemplateDTO}
  | {status: 'rejected'; issues: DocumentTemplateIssues}

/** Ce qui empeche de produire un document ; aucun n'ecrit rien. */
export type DocumentTemplateRenderFailure =
  | {status: 'not_found'}
  | {status: 'invalid_date'}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'render_failed'}

/** Un document produit en memoire, jamais stocke (ADR 066 §5). */
export type DocumentTemplateRenderResult =
  | {status: 'ready'; pdf: Uint8Array; fileName: string}
  | DocumentTemplateRenderFailure

/** Le depot d'un document : le resultat de s32, ou ce qui a empeche le rendu. */
export type DocumentTemplateDepositResult =
  MemberDocumentDepositResult | DocumentTemplateRenderFailure

/**
 * Un depot depuis un modele, tel que le rend l'action (une ligne de lot ou le
 * depot unitaire) : depose, ou en echec avec sa raison traduite et, pour un
 * refus de s32, ses codes (messages de champ de l'ecran 3).
 */
export type DocumentLotLineResult =
  | {status: 'deposited'; documentId: string}
  | {status: 'failed'; reason: string; issues?: MemberDocumentIssue[]}

/** Le destinataire imprime : l'adresse que portera la lettre (ADR 067). */
export type DocumentRecipientDTO = {addressLines: string[]}

/** La cible d'un lot : celle des campagnes de s27 (ADR 060 §1). */
export type DocumentLotTarget = CampaignTarget

/** Une fiche atteinte par un lot. */
export type DocumentLotProfileDTO = {
  id: string
  name: string
  hasCurrentParcel: boolean
}

/** La portee d'un lot : les fiches triees par nom, et leurs decomptes. */
export type DocumentLotReachDTO = {
  profiles: DocumentLotProfileDTO[]
  total: number
  withoutCurrentParcel: number
}

/** La portee lue par l'action du lot, ou son echec ecrit par le serveur. */
export type DocumentLotReachResult =
  | {status: 'ready'; reach: DocumentLotReachDTO}
  | {status: 'error'; message: string}

/** `document-jj-mm-aaaa.pdf` : la date choisie, aucun nom de membre. */
export const documentTemplateFileNameOf = (documentDate: string): string => {
  const [year, month, day] = documentDate.split('-')
  return `document-${day}-${month}-${year}.pdf`
}
