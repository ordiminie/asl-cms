import {
  MemberEmailAdditionDecision,
  MemberEmailConfirmationDecision,
  MemberEmailConfirmationPlan,
  MemberEmailDesignationPlan,
  MemberEmailRecord,
  MemberEmailRemovalPlan,
  MemberEmailReplacement,
  MemberEmailRole,
  MemberEmailRoleConst,
  MemberEmailStatusConst,
} from '../types/domain/member-email-types'
import {sameEmail} from './member-account-rules'

/**
 * Regles pures des adresses d'une fiche (s54, ADR 056) : succession de la
 * titulaire (critere 9) et droits du membre (critere 4). Isomorphe : ni base,
 * ni horloge — l'instant courant est un argument.
 *
 * Invariant : une fiche a au moins une adresse active ⇒ exactement une
 * titulaire. La base garantit le « au plus une » ; ces regles, appliquees
 * dans chaque ecriture, garantissent le « au moins une ». Aucune promotion
 * d'office : le titre ne change que par designation, remplacement ou
 * modification de la titulaire.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const isActive = (email: MemberEmailRecord): boolean =>
  email.status === MemberEmailStatusConst.ACTIVE

const activeHolderOf = (
  emails: readonly MemberEmailRecord[]
): MemberEmailRecord | undefined =>
  emails.find(
    (email) => isActive(email) && email.role === MemberEmailRoleConst.HOLDER
  )

/** Une adresse en attente dont l'echeance est passee. */
export const isPendingExpired = (
  email: MemberEmailRecord,
  now: Date
): boolean =>
  email.status === MemberEmailStatusConst.PENDING &&
  email.expiresAt !== null &&
  email.expiresAt.getTime() <= now.getTime()

/** Les adresses a afficher et a compter : une attente echue est ignoree. */
export const visibleEmails = <Email extends MemberEmailRecord>(
  emails: readonly Email[],
  now: Date
): Email[] => emails.filter((email) => !isPendingExpired(email, now))

/** L'echeance d'un lien de confirmation : le delai du tenant, en jours. */
export const confirmationExpiryOf = (now: Date, days: number): Date =>
  new Date(now.getTime() + days * DAY_MS)

/**
 * Le role d'une adresse qui devient active sur une fiche : titulaire si la
 * fiche n'en a aucune active, sinon le role demande (supplementaire par
 * defaut). Une titulaire choisie retrograde l'ancienne.
 */
export const roleForNewActiveEmail = (
  emails: readonly MemberEmailRecord[],
  requested: MemberEmailRole | undefined
): {role: MemberEmailRole; demoteEmailId: string | null} => {
  const holder = activeHolderOf(emails)
  if (!emails.some(isActive)) {
    return {role: MemberEmailRoleConst.HOLDER, demoteEmailId: null}
  }
  if (requested === MemberEmailRoleConst.HOLDER) {
    return {
      role: MemberEmailRoleConst.HOLDER,
      demoteEmailId: holder?.id ?? null,
    }
  }
  return {role: MemberEmailRoleConst.ADDITIONAL, demoteEmailId: null}
}

/** Le bureau designe une autre adresse active comme titulaire. */
export const planHolderDesignation = (
  emails: readonly MemberEmailRecord[],
  emailId: string
): MemberEmailDesignationPlan => {
  const target = emails.find((email) => email.id === emailId)
  if (!target) return {ok: false, reason: 'not_found'}
  if (!isActive(target)) return {ok: false, reason: 'not_active'}
  if (target.role === MemberEmailRoleConst.HOLDER) {
    return {ok: false, reason: 'already_holder'}
  }
  return {
    ok: true,
    promoteEmailId: target.id,
    demoteEmailId: activeHolderOf(emails)?.id ?? null,
  }
}

/** La remplacante d'une titulaire retiree, validee contre la fiche. */
const holderReplacementPlan = (
  emails: readonly MemberEmailRecord[],
  holder: MemberEmailRecord,
  replacement: MemberEmailReplacement
): MemberEmailRemovalPlan => {
  if (replacement.kind === 'existing') {
    const successor = emails.find(
      (email) => email.id === replacement.emailId && email.id !== holder.id
    )
    if (!successor || !isActive(successor)) {
      return {ok: false, reason: 'invalid_replacement'}
    }
    return {ok: true, removeEmailId: holder.id, promoteEmailId: successor.id}
  }
  if (replacement.kind === 'new') {
    if (emails.some((email) => sameEmail(email.email, replacement.email))) {
      return {ok: false, reason: 'already_listed'}
    }
    return {
      ok: true,
      removeEmailId: holder.id,
      addHolderEmail: replacement.email,
    }
  }
  const othersActive = emails.some(
    (email) => email.id !== holder.id && isActive(email)
  )
  if (othersActive) return {ok: false, reason: 'replacement_required'}
  return {ok: true, removeEmailId: holder.id, mailOnly: true}
}

/**
 * Le bureau retire une adresse. Une titulaire active ne part qu'avec sa
 * remplacante, sauf la derniere adresse active : la fiche passe alors en
 * courrier uniquement (s12d).
 */
export const planEmailRemoval = (
  emails: readonly MemberEmailRecord[],
  emailId: string,
  replacement: MemberEmailReplacement
): MemberEmailRemovalPlan => {
  const target = emails.find((email) => email.id === emailId)
  if (!target) return {ok: false, reason: 'not_found'}
  if (!isActive(target) || target.role !== MemberEmailRoleConst.HOLDER) {
    return {ok: true, removeEmailId: target.id}
  }
  return holderReplacementPlan(emails, target, replacement)
}

/**
 * L'activation d'une adresse en attente. Une modification prend le role de
 * l'adresse qu'elle remplace (titre transmis) et la retire ; un ajout suit
 * la regle d'une nouvelle adresse active, sans promotion d'office.
 */
export const planReplacementConfirmation = (
  emails: readonly MemberEmailRecord[],
  pendingId: string
): MemberEmailConfirmationPlan => {
  const pending = emails.find((email) => email.id === pendingId)
  const replaced = pending?.replacesEmailId
    ? emails.find(
        (email) => email.id === pending.replacesEmailId && isActive(email)
      )
    : undefined
  if (replaced) {
    return {
      role: replaced.role,
      removeEmailId: replaced.id,
      demoteEmailId: null,
    }
  }
  const others = emails.filter((email) => email.id !== pendingId)
  return {...roleForNewActiveEmail(others, undefined), removeEmailId: null}
}

/**
 * Les adresses d'une cellule d'import a ajouter a une fiche, avec leur role.
 * Fiche nouvelle (ou sans adresse active) : la premiere est titulaire. Fiche
 * existante : seules les adresses absentes s'ajoutent, supplementaires ;
 * l'ordre de la cellule ne deplace pas le titre.
 */
export const importedEmailsPlan = (
  existing: readonly MemberEmailRecord[],
  cellEmails: readonly string[]
): {email: string; role: MemberEmailRole}[] => {
  const fresh = cellEmails.filter(
    (email, index) =>
      !existing.some((known) => sameEmail(known.email, email)) &&
      cellEmails.findIndex((other) => sameEmail(other, email)) === index
  )
  const hasActive = existing.some(isActive)
  return fresh.map((email, index) => ({
    email,
    role:
      !hasActive && index === 0
        ? MemberEmailRoleConst.HOLDER
        : MemberEmailRoleConst.ADDITIONAL,
  }))
}

/** L'adresse de la personne connectee sur la fiche : active, egale a la sienne. */
export const ownEmailOf = <Email extends MemberEmailRecord>(
  emails: readonly Email[],
  sessionEmail: string
): Email | undefined =>
  emails.find(
    (email) => isActive(email) && sameEmail(email.email, sessionEmail)
  )

/** Le membre ne modifie que sa propre adresse, active (critere 4). */
export const canMemberReplaceEmail = (
  target: MemberEmailRecord,
  sessionEmail: string
): boolean => isActive(target) && sameEmail(target.email, sessionEmail)

/**
 * Le membre corrige ou annule une adresse en attente seulement s'il en est
 * l'auteur et qu'elle n'est pas echue.
 */
export const canMemberManagePending = (
  target: MemberEmailRecord,
  userId: string,
  now: Date
): boolean =>
  target.status === MemberEmailStatusConst.PENDING &&
  target.addedByUserId === userId &&
  !isPendingExpired(target, now)

/**
 * Ajout d'une adresse par le membre : refuse si elle figure deja sur ses
 * fiches, ou si une fiche de l'association **non reliee a son compte** la
 * porte (critere 7). Le refus ne nomme personne.
 */
export const decideMemberEmailAddition = ({
  email,
  myEmails,
  carrierProfileIds,
  myProfileIds,
  now,
}: {
  email: string
  myEmails: readonly MemberEmailRecord[]
  carrierProfileIds: readonly string[]
  myProfileIds: readonly string[]
  now: Date
}): MemberEmailAdditionDecision => {
  if (
    visibleEmails(myEmails, now).some((known) => sameEmail(known.email, email))
  ) {
    return 'already_listed'
  }
  if (carrierProfileIds.some((id) => !myProfileIds.includes(id))) {
    return 'taken'
  }
  return 'ok'
}

/**
 * Confirmation par lien : un jeton inconnu, echu ou deja utilise donne le
 * meme etat (3c) ; une adresse prise entre-temps n'est pas activee (3d).
 */
export const decideConfirmation = ({
  record,
  takenElsewhere,
  revoked = false,
  now,
}: {
  record: MemberEmailRecord | undefined
  takenElsewhere: boolean
  /** Aucune attente du lien n'est plus sur une fiche reliee a son auteur. */
  revoked?: boolean
  now: Date
}): MemberEmailConfirmationDecision => {
  if (
    !record ||
    record.status !== MemberEmailStatusConst.PENDING ||
    isPendingExpired(record, now)
  ) {
    return 'invalid'
  }
  if (revoked) return 'revoked'
  return takenElsewhere ? 'taken' : 'ok'
}

/**
 * Les attentes d'un lien encore activables (revue s54, C1 ; ADR 056 §5) :
 * celles sans auteur, et celles dont l'auteur est encore relie a la fiche.
 * Un auteur delie d'une fiche (adresse retiree, remplacee, compte ferme) ne
 * peut plus y faire activer d'adresse.
 */
export const pendingRowsStillAuthored = <
  Row extends {memberProfileId: string; addedByUserId: string | null},
>(
  rows: readonly Row[],
  authorProfileIds: ReadonlySet<string>
): Row[] =>
  rows.filter(
    (row) =>
      row.addedByUserId === null || authorProfileIds.has(row.memberProfileId)
  )
