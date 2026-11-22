/**
 * Contrat d'envoi d'email (ADR 005, ADR 017).
 *
 * Tout email du produit passe par un `EmailTransport` : le code metier ne
 * connait aucun fournisseur. Les implementations (`brevo`, `resend`, `file`,
 * `memory`) sont choisies par `EMAIL_TRANSPORT`, voir `get-email-transport.ts`.
 */
export type EmailMessage = {
  /** Expediteur, `adresse` ou `Nom <adresse>`. */
  from: string
  to: string
  subject: string
  html?: string
  /** Version texte, toujours fournie (design system §5). */
  text: string
  /** En-tetes supplementaires (`List-Unsubscribe`, RFC 8058). */
  headers?: Record<string, string>
  /** Adresse de reponse, une adresse seule. */
  replyTo?: string
  /**
   * Etiquettes du fournisseur (s30, ADR 068) : `campaign-<uuid>` sur chaque
   * email d'une campagne, pour en agreger les statistiques.
   */
  tags?: string[]
}

/** Une plage de jours `YYYY-MM-DD` pour l'agregat d'un tag (ADR 068 §6). */
export type TagStatisticsQuery = {
  tag: string
  startDate: string
  endDate: string
}

/**
 * L'agregat d'un tag tel que le fournisseur le compte, ou `unsupported` pour
 * un transport qui ne sait pas lire de statistiques (ADR 068 §2).
 */
export type TagStatisticsResult =
  | {
      status: 'found'
      requests: number
      delivered: number
      uniqueOpens: number
      uniqueClicks: number
    }
  | {status: 'unsupported'}

export type EmailTransport = {
  send: (message: EmailMessage) => Promise<void>
  /**
   * Obligatoire (ADR 068 §2) : un transport sans statistiques le dit par
   * `unsupported`. Un echec reseau ou un refus leve `EmailTransportError`.
   */
  readTagStatistics: (query: TagStatisticsQuery) => Promise<TagStatisticsResult>
}

export const EMAIL_TRANSPORT_NAMES = [
  'brevo',
  'resend',
  'file',
  'memory',
] as const

export type EmailTransportName = (typeof EMAIL_TRANSPORT_NAMES)[number]

/**
 * Echec d'envoi d'un transport, quel que soit le fournisseur. `refused` : le
 * fournisseur a repondu et refuse l'envoi, l'email n'est **certainement pas**
 * parti (s26, ADR 052). Sans reponse (reseau, delai), l'issue est inconnue.
 */
export class EmailTransportError extends Error {
  readonly transport: EmailTransportName
  readonly refused: boolean

  constructor(
    transport: EmailTransportName,
    message: string,
    options?: {cause?: unknown; refused?: boolean}
  ) {
    super(message, options)
    this.name = 'EmailTransportError'
    this.transport = transport
    this.refused = options?.refused ?? false
  }
}

export const isEmailTransportError = (
  error: unknown
): error is EmailTransportError =>
  error instanceof EmailTransportError ||
  (error instanceof Error && error.name === 'EmailTransportError')

const NAMED_ADDRESS = /^\s*(.*?)\s*<\s*([^<>\s]+)\s*>\s*$/

/** Decompose `Nom <adresse>` ; une adresse seule n'a pas de nom. */
export const parseEmailAddress = (
  value: string
): {email: string; name?: string} => {
  const match = value.match(NAMED_ADDRESS)
  if (!match) return {email: value.trim()}

  const name = match[1].replace(/^"(.*)"$/, '$1').trim()
  return name ? {name, email: match[2]} : {email: match[2]}
}
