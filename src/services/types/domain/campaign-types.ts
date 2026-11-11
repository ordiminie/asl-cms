/**
 * Types de domaine des campagnes email (s25, ADR 051). Ecrits **sans importer
 * le modele Drizzle** (`rule-architecture`).
 *
 * Le contenu d'une campagne et ses destinataires sont des donnees
 * personnelles : jamais dans un journal, jamais dans un `'use cache'`.
 */

/** Le mode libre, puis les quatre modeles (contenu provisoire, ADR 051). */
export const CAMPAIGN_TEMPLATE_IDS = [
  'free',
  'reminder',
  'invoice',
  'general_assembly',
  'post_assembly_documents',
] as const
export type CampaignTemplateId = (typeof CAMPAIGN_TEMPLATE_IDS)[number]

/** Les variables reconnues, liste fermee de code : `{nom}` `{parcelle}` `{date}`. */
export const CAMPAIGN_VARIABLES = ['nom', 'parcelle', 'date'] as const
export type CampaignVariable = (typeof CAMPAIGN_VARIABLES)[number]
export type CampaignVariableValues = Record<CampaignVariable, string>

/** Les cibles possibles. s25 : tous les membres ; s27 etend. */
export const CAMPAIGN_TARGET_KINDS = ['all_members'] as const
export type CampaignTargetKind = (typeof CAMPAIGN_TARGET_KINDS)[number]

export const CAMPAIGN_STATUSES = ['sending', 'sent', 'interrupted'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_RECIPIENT_STATUSES = [
  'pending',
  'sent',
  'failed',
] as const
export type CampaignRecipientStatus =
  (typeof CAMPAIGN_RECIPIENT_STATUSES)[number]

/**
 * Longueur maximale de l'objet **recu**, prefixe « {association} — » compris
 * (design system §5.6). Le plafond du champ s'en deduit.
 */
export const CAMPAIGN_SUBJECT_MAX_TOTAL = 60

/** Separateur entre le nom de l'association et l'objet saisi. */
export const CAMPAIGN_SUBJECT_SEPARATOR = ' — '

/** Plafond du texte d'apercu (design system §5.6). */
export const CAMPAIGN_PREHEADER_MAX = 90

/** Plafond du corps Markdown. */
export const CAMPAIGN_BODY_MAX = 20000

/** Lignes par page de l'archive. */
export const CAMPAIGNS_PAGE_SIZE = 25

/**
 * Delai sans progression au-dela duquel une campagne `sending` s'affiche
 * `interrupted` (redemarrage pendant l'envoi, ADR 051). Aucune reprise en V1.
 */
export const CAMPAIGN_STALE_AFTER_MS = 10 * 60 * 1000

/** Intervalle de relecture de la page d'une campagne en cours d'envoi. */
export const CAMPAIGN_PROGRESS_REFRESH_MS = 3000

/** Octets aleatoires d'un jeton de desinscription (256 bits). */
export const UNSUBSCRIBE_TOKEN_BYTES = 32

/**
 * Une campagne archivee telle que le bureau la lit. Liste blanche : ni
 * l'association, ni la soumission, ni le compte auteur, ni l'imitation, ni
 * aucun jeton.
 */
export type CampaignDTO = {
  id: string
  subject: string
  preheader: string | null
  /** Corps tel qu'ecrit : variables non remplacees. */
  bodyMarkdown: string
  templateId: CampaignTemplateId | null
  targetKind: CampaignTargetKind
  recipientCount: number
  withoutEmailCount: number
  unsubscribedCount: number
  sentCount: number
  status: CampaignStatus
  /** Jour d'envoi ISO `YYYY-MM-DD` (Paris). */
  sendDate: string
  authorName: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export type CampaignListPageDTO = {
  items: CampaignDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Le decompte de la cible, avant l'envoi (critere 2). */
export type CampaignTargetCountsDTO = {
  recipients: number
  withoutEmail: number
  unsubscribed: number
  total: number
}

/** Un membre joignable, pour choisir l'apercu (« Voir avec un autre membre »). */
export type CampaignPreviewMemberDTO = {
  id: string
  name: string
}

export type CampaignComposerContextDTO = {
  associationName: string
  /** Adresse de contact des Reglages : les reponses y arrivent. */
  replyTo: string | null
  subjectMaxLength: number
  counts: CampaignTargetCountsDTO
  reachableMembers: CampaignPreviewMemberDTO[]
}

/** Le rendu final d'un envoi pour un destinataire reel (critere 5). */
export type CampaignPreviewDTO = {
  member: CampaignPreviewMemberDTO
  subject: string
  preheader: string | null
  html: string
  text: string
  counts: CampaignTargetCountsDTO
}

export type CampaignContentInput = {
  organizationId: string
  templateId: CampaignTemplateId
  subject: string
  preheader: string
  bodyMarkdown: string
}

export type PreviewCampaignInput = CampaignContentInput & {
  /** La fiche de l'apercu ; absente, le premier membre joignable. */
  memberProfileId?: string
}

export type SendCampaignInput = CampaignContentInput & {
  submissionId: string
}

export type CampaignsPageInput = {organizationId: string; page: number}

export type CampaignByIdInput = {organizationId: string; campaignId: string}

export type PreviewCampaignResult =
  | {status: 'ok'; preview: CampaignPreviewDTO}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}

export type SendCampaignResult =
  | {
      status: 'created'
      campaignId: string
      /**
       * La livraison, a poser dans `after()` par l'action. `null` quand la
       * soumission etait deja connue (rejeu, double clic) : la livraison de la
       * premiere soumission est deja partie, une seconde ecrirait deux fois.
       */
      deliver: (() => Promise<void>) | null
    }
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}
  | {status: 'delivery_disabled'}

export type CampaignReadResult =
  {status: 'found'; campaign: CampaignDTO} | {status: 'not_found'}

/** Une demande de desinscription : association du domaine appele, jeton. */
export type UnsubscribeRequestInput = {organizationId: string; token: string}

/** Etat de la page publique de desinscription (ecran 6). */
export type UnsubscribePageState =
  {status: 'confirm'} | {status: 'already'} | {status: 'invalid'}

export type ConfirmUnsubscribeResult =
  {status: 'unsubscribed'} | {status: 'already'} | {status: 'invalid'}

/** Le refus d'une fiche, tel que la fiche du bureau le montre (ecran 5). */
export type MemberUnsubscribeDTO = {
  /** Instant du refus, ISO. */
  createdAt: string
}

/** Les champs du composeur (ecran 2). */
export type CampaignFormField =
  'templateId' | 'subject' | 'preheader' | 'bodyMarkdown'

export type CampaignFormError = {field: CampaignFormField; message: string}

/** Ce que l'action « Voir l'apercu » rend au composeur ; la saisie reste. */
export type PreviewCampaignActionResult =
  | {status: 'ok'; preview: CampaignPreviewDTO}
  | {status: 'invalid'; errors: CampaignFormError[]}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}
  | {status: 'error'; message: string}

/** Ce que l'action « Envoyer » rend a l'apercu ; la saisie reste. */
export type SendCampaignActionResult =
  | {status: 'created'; campaignId: string}
  | {status: 'invalid'; errors: CampaignFormError[]}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}
  | {status: 'delivery_disabled'}
  | {status: 'error'; message: string}

/** Ce que la page publique recoit apres « Me desinscrire » : aucun detail. */
export type ConfirmUnsubscribeActionResult =
  | {status: 'unsubscribed'}
  | {status: 'already'}
  | {status: 'invalid'}
  | {status: 'error'}
