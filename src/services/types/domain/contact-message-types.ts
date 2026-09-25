/**
 * Types de domaine des messages recus depuis la page Contact (s08, ADR 025).
 * Ecrits **sans importer le modele Drizzle** (`rule-architecture`) : la
 * presentation qui les consomme ne depend pas de la persistance.
 */

export type ContactMessageDTO = {
  id: string
  organizationId: string
  /** Nul quand le visiteur n'a pas donne son nom (champ facultatif). */
  senderName: string | null
  senderEmail: string
  subject: string
  body: string
  read: boolean
  /** L'email d'avertissement au bureau n'est pas parti. */
  notificationFailed: boolean
  createdAt: Date
}

/** Une page de la liste du bureau, et de quoi ecrire « Page x sur y ». */
export type ContactMessageListPageDTO = {
  items: ContactMessageDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  unreadCount: number
}

/** Ce qu'un visiteur envoie depuis `/contact`. Jamais d'adresse IP. */
export type CreateContactMessageInput = {
  organizationId: string
  locale: string
  name?: string
  email: string
  subject: string
  body: string
}

/**
 * Resultat d'une soumission valide. Un echec de notification **ne fait pas**
 * echouer la soumission : le message est ecrit, le bureau le voit.
 */
export type ContactMessageSubmissionResult = {
  status: 'created'
  id: string
  notificationFailed: boolean
}

/**
 * Taille de page de la liste du bureau (§3.5) : une convention de
 * presentation, pas un parametre d'association.
 */
export const CONTACT_MESSAGES_BUREAU_PAGE_SIZE = 25

export const countContactMessagePages = (
  total: number,
  pageSize: number
): number => Math.max(1, Math.ceil(total / pageSize))

/**
 * Fuseau d'affichage des dates de reception : le produit est servi en France
 * (ADR 008), comme le compteur du limiteur de s03.
 */
export const CONTACT_MESSAGE_TIME_ZONE = 'Europe/Paris'

export type ReceivedAtParts = {
  /** « 2 septembre 2026 » */
  date: string
  /** « 02/09/2026 », pour un tableau (§3.6) */
  shortDate: string
  hour: string
  minute: string
}

/** Les morceaux d'une date de reception, heure de Paris. */
export const receivedAtPartsOf = (
  createdAt: Date,
  locale: string
): ReceivedAtParts => {
  const partsOf = (options: Intl.DateTimeFormatOptions) =>
    Object.fromEntries(
      new Intl.DateTimeFormat(locale, {
        timeZone: CONTACT_MESSAGE_TIME_ZONE,
        ...options,
      })
        .formatToParts(createdAt)
        .map((part) => [part.type, part.value])
    )
  const long = partsOf({
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const short = partsOf({day: '2-digit', month: '2-digit', year: 'numeric'})

  return {
    date: `${long.day} ${long.month} ${long.year}`,
    shortDate: `${short.day}/${short.month}/${short.year}`,
    hour: long.hour,
    minute: long.minute,
  }
}
