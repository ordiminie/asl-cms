import {v5 as uuidv5} from 'uuid'

import {UNPAID_REMINDER_INVOICES_VARIABLE} from '../types/domain/campaign-types'
import {addDays} from './campaign-schedule-rules'
import {
  formatAmountCents,
  type InvoiceStatusClassification,
  isUnpaidInvoice,
} from './member-invoice-rules'

/**
 * Regles pures des relances d'impayes (s29, ADR 070). Ni base ni horloge : le
 * jour du jour vient de l'appelant (`calendarDayOf(instant)`). Les jours sont
 * ISO `YYYY-MM-DD`. Seul `isUnpaidInvoice` lit un statut.
 */

const DAYS_PER_WEEK = 7

/** Le nombre de rangs d'une serie : le nombre d'intervalles des reglages. */
const lastRankOf = (delays: readonly number[]): number => delays.length

/** Un rang deja cree pour une echeance, tel que sa campagne le dit. */
export type ReminderRankState = {
  rank: number
  /** Sa campagne est close : `sent` ou `interrupted` (ADR 070 §5). */
  finished: boolean
  /** Le dernier jour ou un email du rang est reellement parti, ou rien. */
  sentOn: string | null
}

const weeksUpTo = (delays: readonly number[], rank: number): number =>
  delays.slice(0, rank).reduce((total, weeks) => total + weeks, 0)

/**
 * Le jour du rang `rank` (ADR 070 §5) : `echeance + intervalles 1..rank`,
 * repousse a `envoi reel du rang precedent + intervalle rank` si ce dernier
 * est plus tard. Le rang 1 ne depend que de l'echeance.
 */
export const plannedReminderDayOf = (input: {
  dueOn: string
  delays: readonly number[]
  rank: number
  previousSentOn: string | null
}): string => {
  const theoretical = addDays(
    input.dueOn,
    weeksUpTo(input.delays, input.rank) * DAYS_PER_WEEK
  )
  if (input.rank === 1 || !input.previousSentOn) return theoretical
  const afterPrevious = addDays(
    input.previousSentOn,
    (input.delays[input.rank - 1] ?? 0) * DAYS_PER_WEEK
  )
  return afterPrevious > theoretical ? afterPrevious : theoretical
}

/**
 * Le rang du par cette echeance aujourd'hui, ou rien (calage « une a la
 * fois », ADR 070 §5) : au plus un, le suivant du dernier cree, seulement
 * une fois celui-ci termine, et seulement a son jour ou apres.
 */
export const dueReminderRankOf = (input: {
  dueOn: string
  delays: readonly number[]
  ranks: readonly ReminderRankState[]
  today: string
}): number | null => {
  const last = [...input.ranks].sort((a, b) => b.rank - a.rank)[0]
  if (last && (!last.finished || last.rank >= lastRankOf(input.delays))) {
    return null
  }
  const rank = last ? last.rank + 1 : 1
  const day = plannedReminderDayOf({
    dueOn: input.dueOn,
    delays: input.delays,
    rank,
    previousSentOn: last?.sentOn ?? null,
  })
  return input.today >= day ? rank : null
}

type DatedInvoice = {memberProfileId: string; status: string; dueOn: string}

/** Les fiches dont au moins une facture d'echeance `dueOn` est impayee. */
export const unpaidProfileIdsForDueOn = (
  invoices: readonly DatedInvoice[],
  classification: InvoiceStatusClassification,
  dueOn: string
): Set<string> =>
  new Set(
    invoices
      .filter(
        (invoice) =>
          invoice.dueOn === dueOn &&
          isUnpaidInvoice(invoice.status, classification)
      )
      .map((invoice) => invoice.memberProfileId)
  )

/** Les echeances qui portent au moins un impaye, dans l'ordre. */
export const unpaidDueDatesOf = (
  invoices: readonly DatedInvoice[],
  classification: InvoiceStatusClassification
): string[] =>
  [
    ...new Set(
      invoices
        .filter((invoice) => isUnpaidInvoice(invoice.status, classification))
        .map((invoice) => invoice.dueOn)
    ),
  ].sort()

/** Un jour ISO ecrit `jj/mm/aaaa`. */
export const formatReminderDay = (day: string): string => {
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

/** Une facture impayee telle que `{factures}` la cite. */
export type UnpaidInvoiceLine = {
  /** L'objet compose de la facture (modele du tenant, s19). */
  subject: string
  parcelNumber: string | null
  amountCents: number
  dueOn: string
}

/** Les valeurs d'une ligne, deja formatees ; le texte vient des messages. */
export type UnpaidInvoiceLineValues = {
  subject: string
  parcelNumber: string | null
  amount: string
  dueOn: string
}

/**
 * La valeur de `{factures}` (ADR 070 §9) : une puce Markdown par facture,
 * montant en euros (`formatAmountCents`) et date `jj/mm/aaaa`. La phrase de
 * chaque ligne est fournie par l'appelant, lue dans les messages.
 */
export const formatUnpaidInvoicesList = (
  invoices: readonly UnpaidInvoiceLine[],
  lineOf: (values: UnpaidInvoiceLineValues) => string
): string =>
  invoices
    .map(
      (invoice) =>
        `- ${lineOf({
          subject: invoice.subject,
          parcelNumber: invoice.parcelNumber,
          amount: formatAmountCents(invoice.amountCents),
          dueOn: formatReminderDay(invoice.dueOn),
        })}`
    )
    .join('\n')

/** Espace de noms constant des soumissions de relance (uuid v5). */
const UNPAID_REMINDER_SUBMISSION_NAMESPACE =
  '6f1d2c3b-8a4e-4b7f-9c0d-1e2f3a4b5c6d'

/**
 * La soumission de la campagne d'un rang (ADR 070 §6) : uuid v5 de
 * l'association, de l'echeance et du rang. Un passage rejoue retrouve la
 * campagne existante par l'unicite `(organization_id, submission_id)`.
 */
export const reminderSubmissionIdOf = (
  organizationId: string,
  dueOn: string,
  rank: number
): string =>
  uuidv5(
    `${organizationId}:${dueOn}:${rank}`,
    UNPAID_REMINDER_SUBMISSION_NAMESPACE
  )

/**
 * Remplace `{factures}` par sa liste Markdown **avant** le rendu du corps :
 * c'est une liste a puces, pas une valeur a echapper. Les autres variables
 * restent, remplacees ensuite par le gabarit.
 */
export const substituteInvoicesList = (text: string, list: string): string =>
  text.replaceAll(`{${UNPAID_REMINDER_INVOICES_VARIABLE}}`, list)
