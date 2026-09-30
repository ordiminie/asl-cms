/**
 * Types de domaine des signalements (s10, ADR 028). Ecrits **sans importer le
 * modele Drizzle** (`rule-architecture`) : la presentation qui les consomme ne
 * depend pas de la persistance.
 */

/**
 * Les statuts d'un signalement, **dans l'ordre ou ils se suivent** (critere
 * 3, decision C) : pas de retour, pas de saut.
 */
export const REPORT_STATUSES = ['reported', 'in_progress', 'resolved'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const ReportStatusConst = {
  REPORTED: 'reported',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
} as const satisfies Record<string, ReportStatus>

/** Plafonds de longueur (decision G). */
export const REPORT_LOCATION_MAX_LENGTH = 200
export const REPORT_DESCRIPTION_MAX_LENGTH = 2000
export const REPORTER_NAME_MAX_LENGTH = 120
export const REPORTER_PHONE_MAX_LENGTH = 30

/** Chiffres, espaces et `+ . - ( )` seulement (decision G). */
export const REPORTER_PHONE_PATTERN = /^[0-9 +.\-()]+$/

/**
 * Taille de page de la file du bureau (§3.5, decision H) : une convention de
 * presentation, pas un parametre d'association. La meme en mobile.
 */
export const INCIDENT_REPORTS_BUREAU_PAGE_SIZE = 25

/** Un changement de statut, horodate et attribue. */
export type IncidentReportEventDTO = {
  id: string
  status: ReportStatus
  /**
   * Nom de l'auteur **au moment du changement** ; nul pour l'evenement
   * initial, « depuis le site ».
   */
  authorName: string | null
  createdAt: Date
}

/** Une ligne de la file du bureau. */
export type IncidentReportListItemDTO = {
  id: string
  organizationId: string
  /** Nul quand le signalement a ete envoye sans categorie (decision D). */
  categoryName: string | null
  /** La categorie a ete supprimee depuis : son nom reste lu (critere 5). */
  categoryDeleted: boolean
  location: string
  reporterName: string | null
  reporterEmail: string | null
  reporterPhone: string | null
  status: ReportStatus
  /** L'email d'avertissement au bureau n'est pas parti vers l'un des destinataires. */
  notificationFailed: boolean
  createdAt: Date
}

/** Le detail d'un signalement, avec son historique dans l'ordre. */
export type IncidentReportDTO = IncidentReportListItemDTO & {
  description: string
  events: IncidentReportEventDTO[]
}

/** Combien de signalements par statut, pour la ligne `meta` de la file. */
export type IncidentReportStatusCounts = Record<ReportStatus, number>

/** Une page de la file du bureau, et de quoi ecrire « Page x sur y ». */
export type IncidentReportListPageDTO = {
  items: IncidentReportListItemDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  counts: IncidentReportStatusCounts
}

/**
 * Ce qu'un visiteur envoie depuis `/signaler`. **Jamais d'adresse IP, jamais
 * de membre** : aucun rapprochement n'est fait a partir des coordonnees
 * (critere 8).
 */
export type CreateIncidentReportInput = {
  organizationId: string
  locale: string
  categoryId?: string
  location: string
  description: string
  name?: string
  email?: string
  phone?: string
}

/**
 * Resultat d'une soumission valide. Un echec de notification **ne fait pas**
 * echouer la soumission : le signalement est ecrit, le bureau le voit.
 */
export type IncidentReportSubmissionResult = {
  status: 'created'
  id: string
  notificationFailed: boolean
}

/**
 * Resultat d'un changement de statut. `stale` : un autre membre du bureau l'a
 * fait changer entre-temps (decision C) ; rien n'a ete ecrit.
 */
export type IncidentReportStatusChangeResult =
  {status: 'changed'; reportStatus: ReportStatus} | {status: 'stale'}

export const countIncidentReportPages = (
  total: number,
  pageSize: number
): number => Math.max(1, Math.ceil(total / pageSize))

/**
 * Destinataires de l'avertissement au bureau (decision F, ADR 028 §5) :
 * l'adresse de contact des Reglages, puis celle de la categorie si elle en
 * porte une. Dedupliques sans tenir compte de la casse ; une adresse absente
 * ou blanche est ignoree.
 */
export const resolveReportRecipients = (
  contactEmail: string | null | undefined,
  routingEmail: string | null | undefined
): string[] =>
  [contactEmail, routingEmail]
    .map((address) => address?.trim() ?? '')
    .filter((address) => address !== '')
    .filter(
      (address, index, all) =>
        all.findIndex(
          (other) => other.toLowerCase() === address.toLowerCase()
        ) === index
    )

/** Lien `tel:` d'un numero saisi librement : chiffres et `+` seulement. */
export const telHrefOf = (phone: string): string =>
  `tel:${phone.replace(/[^0-9+]/g, '')}`
