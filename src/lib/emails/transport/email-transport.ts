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
}

export type EmailTransport = {
  send: (message: EmailMessage) => Promise<void>
}

export const EMAIL_TRANSPORT_NAMES = [
  'brevo',
  'resend',
  'file',
  'memory',
] as const

export type EmailTransportName = (typeof EMAIL_TRANSPORT_NAMES)[number]

/** Echec d'envoi d'un transport, quel que soit le fournisseur. */
export class EmailTransportError extends Error {
  readonly transport: EmailTransportName

  constructor(
    transport: EmailTransportName,
    message: string,
    options?: {cause?: unknown}
  ) {
    super(message, options)
    this.name = 'EmailTransportError'
    this.transport = transport
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
