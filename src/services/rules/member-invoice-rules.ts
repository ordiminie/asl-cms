import {
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_STATUS_LABELS_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  INVOICE_SUBJECT_YEAR_TOKEN,
  ResolvedAssociationSettings,
} from '../types/domain/association-settings-types'
import type {InvoiceStatusClass} from '../types/domain/member-invoice-types'

/**
 * Regles pures des factures des membres (s19, ADR 059). Isomorphes : ni base,
 * ni horloge, ni import serveur. s21, s27 et s29 importent le classement et le
 * predicat « impaye » ; ils n'interpretent jamais un statut eux-memes.
 *
 * Le statut est **opaque** : aucune valeur n'est ecrite ici. La comparaison est
 * exacte apres suppression des espaces de bord, casse respectee.
 */

export type {InvoiceStatusClass}

export type InvoiceStatusClassification = {
  unpaid: readonly string[]
  settled: readonly string[]
}

/** Un statut par ligne : bords retires, lignes vides et doublons ignores. */
export const parseStatusList = (text: string | null | undefined): string[] => [
  ...new Set(
    (text ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
  ),
]

export const classifyInvoiceStatus = (
  status: string,
  classification: InvoiceStatusClassification
): InvoiceStatusClass => {
  const value = status.trim()
  if (classification.unpaid.includes(value)) return 'unpaid'
  if (classification.settled.includes(value)) return 'settled'
  return 'unclassified'
}

/** Le predicat « impaye » : un statut a classer n'est pas impaye. */
export const isUnpaidInvoice = (
  status: string,
  classification: InvoiceStatusClassification
): boolean => classifyInvoiceStatus(status, classification) === 'unpaid'

const textOf = (
  settings: ResolvedAssociationSettings,
  key: string
): string | undefined => {
  const value = settings[key]?.value
  return typeof value === 'string' ? value : undefined
}

/** Le classement en vigueur, lu des deux reglages du tenant. */
export const getInvoiceStatusClassification = (
  settings: ResolvedAssociationSettings
): InvoiceStatusClassification => ({
  unpaid: parseStatusList(
    textOf(settings, BILLING_UNPAID_STATUSES_SETTING_KEY)
  ),
  settled: parseStatusList(
    textOf(settings, BILLING_SETTLED_STATUSES_SETTING_KEY)
  ),
})

/** Les statuts ranges dans les deux listes : refuses a l'enregistrement. */
export const findStatusesInBothLists = (
  classification: InvoiceStatusClassification
): string[] =>
  classification.unpaid.filter((status) =>
    classification.settled.includes(status)
  )

/** Statuts proposes a la saisie manuelle : l'union des deux listes (ADR 059 §8). */
export const selectableInvoiceStatuses = (
  classification: InvoiceStatusClassification
): string[] => [
  ...new Set([...classification.unpaid, ...classification.settled]),
]

/** Modele de l'objet en vigueur ; chaine vide si rien de valide. */
export const getInvoiceSubjectTemplate = (
  settings: ResolvedAssociationSettings
): string => textOf(settings, BILLING_INVOICE_SUBJECT_SETTING_KEY) ?? ''

/** L'objet affiche au membre : le modele, `{année}` remplace par l'annee. */
export const composeInvoiceSubject = (template: string, year: number): string =>
  template.replaceAll(INVOICE_SUBJECT_YEAR_TOKEN, String(year))

const GROUP_SEPARATOR = ' '
const CENTS_PER_EURO = 100
/** Plafond d'un montant : celui d'un entier Postgres, en centimes. */
export const MAX_AMOUNT_CENTS = 2_147_483_647

/** « 412,50 » pour 41250 centimes ; milliers separes par une espace fine. */
export const formatAmountCents = (cents: number): string => {
  const euros = Math.trunc(cents / CENTS_PER_EURO)
  const rest = String(Math.abs(cents % CENTS_PER_EURO)).padStart(2, '0')
  const grouped = String(euros).replaceAll(
    /\B(?=(\d{3})+(?!\d))/g,
    GROUP_SEPARATOR
  )
  return `${grouped},${rest}`
}

const AMOUNT_PATTERN = /^(\d+)(?:[,.](\d{1,2}))?$/

/**
 * Lit un montant saisi en euros (« 412,50 », « 412.5 », « 1 234 ») en
 * centimes. Rien si la saisie n'est pas un montant positif a deux decimales
 * au plus.
 */
export const parseAmountToCents = (raw: string): number | undefined => {
  const compact = raw.replaceAll(/[\s  ]/g, '')
  const match = AMOUNT_PATTERN.exec(compact)
  if (!match) return undefined
  const cents =
    Number(match[1]) * CENTS_PER_EURO + Number((match[2] ?? '0').padEnd(2, '0'))
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : undefined
}

/**
 * Les fiches en impaye (s27, ADR 060 §3) : celles dont **au moins une**
 * facture rendue par le fournisseur actif est impayee. Seul le predicat
 * `isUnpaidInvoice` lit un statut.
 */
export const unpaidProfileIdsOf = (
  invoices: readonly {memberProfileId: string; status: string}[],
  classification: InvoiceStatusClassification
): Set<string> =>
  new Set(
    invoices
      .filter((invoice) => isUnpaidInvoice(invoice.status, classification))
      .map((invoice) => invoice.memberProfileId)
  )

const LABEL_SEPARATOR = '='

/**
 * Les libelles des statuts (s20, ADR 062 §5) : « statut = libelle » par
 * ligne, coupe au premier « = », bords retires. Une ligne sans « = », au
 * statut ou au libelle vide, est ignoree ; la premiere occurrence d'un statut
 * l'emporte.
 */
export const parseStatusLabels = (
  text: string | null | undefined
): Map<string, string> => {
  const labels = new Map<string, string>()
  for (const line of (text ?? '').split(/\r?\n/)) {
    const at = line.indexOf(LABEL_SEPARATOR)
    if (at === -1) continue
    const status = line.slice(0, at).trim()
    const label = line.slice(at + 1).trim()
    if (status === '' || label === '' || labels.has(status)) continue
    labels.set(status, label)
  }
  return labels
}

/**
 * Le mot que lisent les membres pour un statut : son libelle, sinon le statut
 * brut. Comparaison exacte apres les bords, casse respectee. Jamais un
 * classement : seul `classifyInvoiceStatus` lit un statut pour classer.
 */
export const statusLabelOf = (
  status: string,
  labels: ReadonlyMap<string, string>
): string => labels.get(status.trim()) ?? status

/** Les libelles en vigueur, lus du reglage du tenant. */
export const getInvoiceStatusLabels = (
  settings: ResolvedAssociationSettings
): Map<string, string> =>
  parseStatusLabels(textOf(settings, BILLING_STATUS_LABELS_SETTING_KEY))
