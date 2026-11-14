/**
 * Types de domaine des questions posees par un membre au bureau (s23). Ecrits
 * **sans importer le modele Drizzle** (`rule-architecture`).
 */

const presentAddress = (
  address: string | null | undefined
): string | undefined => {
  const trimmed = address?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Le destinataire **unique** d'une question (critere 2, D1) : l'adresse de son
 * sujet si elle existe, sinon l'adresse de contact de l'association. Routage
 * **exclusif**, different de celui des signalements (ADR 028 §5, contact
 * **plus** categorie). Une adresse vide ou blanche est absente ; aucune des
 * deux → `undefined`, a l'appelant de lever.
 */
export const resolveQuestionRecipient = (
  routingEmail: string | null | undefined,
  contactEmail: string | null | undefined
): string | undefined =>
  presentAddress(routingEmail) ?? presentAddress(contactEmail)

/**
 * Longueur maximale d'une question (D6) : celle de la description d'un
 * signalement. Une limite de saisie, pas un seuil metier.
 */
export const MEMBER_QUESTION_BODY_MAX_LENGTH = 2000

/**
 * Taille de page de la file du bureau (§3.5) : une convention de
 * presentation, pas un parametre d'association.
 */
export const MEMBER_QUESTIONS_BUREAU_PAGE_SIZE = 25

/** Ce qu'un membre connecte envoie : aucune identite, jamais de fiche. */
export type CreateMyQuestionInput = {
  organizationId: string
  locale: string
  categoryId: string
  body: string
}

/**
 * Resultat d'une question envoyee. Un echec de notification **ne fait pas**
 * echouer la soumission : la question est ecrite, le bureau la voit.
 * `not_found` : le compte connecte n'a pas de fiche dans l'association.
 */
export type MyQuestionSubmissionResult =
  | {status: 'created'; id: string; notificationFailed: boolean}
  | {status: 'not_found'}

/** Ce que le bureau recoit du membre : le nom et l'email de sa fiche. */
export type MyQuestionIdentityDTO = {
  name: string
  email: string | null
}

/** Une question vue par le bureau, identite lue sur la fiche (critere 4). */
export type MemberQuestionDTO = {
  id: string
  memberId: string
  memberName: string
  /** Nul quand la fiche n'a pas d'adresse email. */
  memberEmail: string | null
  categoryName: string
  /** Le sujet a ete supprime depuis : son nom reste lu (critere 5). */
  categoryDeleted: boolean
  body: string
  /** L'email au bureau n'est pas parti. */
  notificationFailed: boolean
  createdAt: Date
}

/** Une page de la file du bureau, et de quoi ecrire « Page x sur y ». */
export type MemberQuestionListPageDTO = {
  items: MemberQuestionDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  /** L'association a-t-elle au moins un sujet ouvert aux membres ? */
  hasOpenCategories: boolean
}

export const countMemberQuestionPages = (
  total: number,
  pageSize: number
): number => Math.max(1, Math.ceil(total / pageSize))
