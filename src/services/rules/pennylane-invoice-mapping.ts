import type {
  PennylaneCustomer,
  PennylaneInvoice,
} from '@/lib/pennylane/pennylane-schemas'

import {MAX_AMOUNT_CENTS} from './member-invoice-rules'

/**
 * Regles pures du mappage des factures Pennylane (s20, ADR 062 §2 a §4).
 * Isomorphes : ni base, ni horloge, ni reseau.
 *
 * - Rapprochement : `customer.id` → `external_reference` du client → fiche
 *   dont l'identifiant client Pennylane est egal, sans casse. Jamais l'`id`
 *   du client, jamais sa « Reference Client ».
 * - Les valeurs ci-dessous (`credit_note`, `EUR`) sont des codes du contrat
 *   de l'API Pennylane, pas des valeurs d'une association (ADR 010).
 */

/** Statut Pennylane d'un avoir : ecarte (arbitrage du 19/11, ADR 062 §3). */
const CREDIT_NOTE_STATUS = 'credit_note'
/** Seule devise transportee : le montant est en euros implicites (ADR 059). */
const SUPPORTED_CURRENCY = 'EUR'
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/
const CENTS_PER_EURO = 100

/** La fiche rattachee a une reference externe. */
export type PennylaneProfileRef = {id: string; name: string}

/** Parcelle(s) et compteur lus sur la facture ; un controle, jamais affiche. */
export type InvoiceTerrainLine = {parcels: string[]; meter: string | null}

/** Une facture a ecrire dans `member_invoice` avec `source = pennylane`. */
export type PennylaneInvoiceWrite = {
  externalId: string
  memberProfileId: string
  invoiceNumber: string | null
  year: number
  issuedOn: string
  dueOn: string
  amountCents: number
  status: string
  hasPdf: boolean
  /** La ligne de terrain de la facture, pour le controle ; nulle sans elle. */
  terrain: InvoiceTerrainLine | null
}

export type PennylaneSkipReason =
  | 'draft'
  | 'creditNote'
  | 'noCustomer'
  | 'noDate'
  | 'notEur'
  | 'nonPositive'
  | 'unmatched'

export type PennylaneSkippedCounts = Record<PennylaneSkipReason, number>

export type PennylaneUnmatchedCustomer = {
  id: string
  name: string
  reference: string | null
}

export type PennylaneMappingResult = {
  writes: PennylaneInvoiceWrite[]
  skipped: PennylaneSkippedCounts
  unmatchedCustomers: PennylaneUnmatchedCustomer[]
}

export type PennylaneMappingInput = {
  customers: readonly PennylaneCustomer[]
  invoices: readonly PennylaneInvoice[]
  /** Fiches de l'association par identifiant client Pennylane. */
  profilesByExternalRef: ReadonlyMap<string, PennylaneProfileRef>
}

const matchKey = (value: string): string => value.trim().toLowerCase()

const isIsoDate = (value: string | null): value is string => {
  const match = value === null ? null : ISO_DATE.exec(value)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Centimes exacts d'un montant decimal de l'API ; rien s'il n'est pas > 0. */
const amountCentsOf = (amount: string): number | undefined => {
  const match = DECIMAL_AMOUNT.exec(amount.trim())
  if (!match) return undefined
  const cents =
    Number(match[1]) * CENTS_PER_EURO + Number((match[2] ?? '0').padEnd(2, '0'))
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : undefined
}

/** Le premier motif qui ecarte la facture avant rapprochement, ou rien. */
const skipReasonOf = (
  invoice: PennylaneInvoice
): Exclude<PennylaneSkipReason, 'unmatched'> | undefined => {
  if (invoice.draft) return 'draft'
  if (invoice.status.trim() === CREDIT_NOTE_STATUS) return 'creditNote'
  if (invoice.customerId === null) return 'noCustomer'
  if (
    !isIsoDate(invoice.date) ||
    !isIsoDate(invoice.deadline) ||
    invoice.deadline < invoice.date
  ) {
    return 'noDate'
  }
  if (invoice.currency.trim().toUpperCase() !== SUPPORTED_CURRENCY) {
    return 'notEur'
  }
  if (amountCentsOf(invoice.amount) === undefined) return 'nonPositive'
  return undefined
}

const emptySkippedCounts = (): PennylaneSkippedCounts => ({
  draft: 0,
  creditNote: 0,
  noCustomer: 0,
  noDate: 0,
  notEur: 0,
  nonPositive: 0,
  unmatched: 0,
})

/**
 * Les factures Pennylane a ecrire, celles ecartees par motif, et les clients
 * Pennylane qui portent une facture sans fiche (critere 3).
 */
export const mapPennylaneInvoices = ({
  customers,
  invoices,
  profilesByExternalRef,
}: PennylaneMappingInput): PennylaneMappingResult => {
  const customersById = new Map(customers.map((c) => [c.id, c]))
  const profiles = new Map(
    [...profilesByExternalRef].map(([ref, profile]) => [matchKey(ref), profile])
  )
  const skipped = emptySkippedCounts()
  const unmatched = new Map<string, PennylaneUnmatchedCustomer>()
  const writes: PennylaneInvoiceWrite[] = []

  for (const invoice of invoices) {
    const reason = skipReasonOf(invoice)
    if (reason) {
      skipped[reason] += 1
      continue
    }
    const customerId = invoice.customerId as string
    const owner = customersById.get(customerId)
    const profile = owner?.externalReference
      ? profiles.get(matchKey(owner.externalReference))
      : undefined
    if (!profile) {
      skipped.unmatched += 1
      unmatched.set(customerId, {
        id: customerId,
        name: owner?.name ?? '',
        reference: owner?.reference ?? null,
      })
      continue
    }
    const issuedOn = invoice.date as string
    writes.push({
      externalId: invoice.id,
      memberProfileId: profile.id,
      invoiceNumber: invoice.invoiceNumber,
      year: Number(issuedOn.slice(0, 4)),
      issuedOn,
      dueOn: invoice.deadline as string,
      amountCents: amountCentsOf(invoice.amount) as number,
      status: invoice.status,
      hasPdf: invoice.hasPdf,
      terrain: parseInvoiceTerrainLine(invoice.freeText),
    })
  }

  return {writes, skipped, unmatchedCustomers: [...unmatched.values()]}
}

const PARCEL_LABEL = /parcelle\s*:/i
const METER_LABEL = /\s+-\s+compteur\s*:/i
const FIELD_SEPARATOR = /\s-(?:\s|$)/
const SECTION_AND_NUMBER = /^([A-Za-z]+)\s*(\d.*)$/

const normalizeParcel = (value: string): string =>
  value.trim().replaceAll(/\s+/g, ' ').toUpperCase()

/**
 * Les parcelles d'une ecriture abregee : « AH 6-7 » vaut AH 6 et AH 7,
 * « AH 6-AH 7 » aussi ; « AH 6 B » reste une parcelle. Sert a la facture
 * comme a la fiche importee, qui porte parfois l'abrege tel quel.
 */
const expandParcels = (text: string): string[] => {
  let section: string | null = null
  const parcels: string[] = []
  for (const part of text.split('-').map((piece) => piece.trim())) {
    if (part === '') continue
    const match = SECTION_AND_NUMBER.exec(part)
    if (match) {
      section = match[1]
      parcels.push(normalizeParcel(`${match[1]} ${match[2]}`))
    } else if (section && /^\d/.test(part)) {
      parcels.push(normalizeParcel(`${section} ${part}`))
    } else {
      parcels.push(normalizeParcel(part))
    }
  }
  return parcels
}

/**
 * La ligne « Numero parcelle : … - Compteur : … » du texte libre d'une
 * facture (ADR 062 §4), ou rien : ligne absente, ou sans parcelle.
 */
export const parseInvoiceTerrainLine = (
  text: string | null | undefined
): InvoiceTerrainLine | null => {
  const label = (text ?? '')
    .split(/\r?\n/)
    .map((line) => ({line, at: PARCEL_LABEL.exec(line)}))
    .find(({at}) => at !== null)
  if (!label?.at) return null
  const afterLabel = label.line.slice(label.at.index + label.at[0].length)
  const meterAt = METER_LABEL.exec(afterLabel)
  if (!meterAt) return null
  const parcels = expandParcels(afterLabel.slice(0, meterAt.index))
  if (parcels.length === 0) return null
  const meter = afterLabel
    .slice(meterAt.index + meterAt[0].length)
    .split(FIELD_SEPARATOR)[0]
    .trim()
  return {parcels, meter: meter === '' ? null : meter}
}

/**
 * La facture dit-elle un autre terrain que la fiche a la date d'emission ?
 * Parcelles comparees en ensemble (abreges developpes, sans casse ni
 * espaces) ; le compteur, seulement quand la facture en ecrit un.
 */
export const compareTerrain = (
  parsed: InvoiceTerrainLine,
  ficheParcels: readonly {number: string; meterNumber: string | null}[]
): boolean => {
  const onInvoice = new Set(parsed.parcels.map(normalizeParcel))
  const onFiche = new Set(ficheParcels.flatMap((p) => expandParcels(p.number)))
  const sameParcels =
    onInvoice.size === onFiche.size &&
    [...onInvoice].every((parcel) => onFiche.has(parcel))
  if (!sameParcels) return true
  if (parsed.meter === null) return false
  const meters = new Set(
    ficheParcels
      .map((p) => p.meterNumber?.trim().toUpperCase())
      .filter((meter): meter is string => Boolean(meter))
  )
  return !meters.has(parsed.meter.trim().toUpperCase())
}

/** Une periode de propriete, telle que la lecture datee la rend. */
export type OwnershipPeriod = {
  memberProfileId: string
  number: string
  meterNumber: string | null
  startsOn: string
  endsOn: string | null
}

/** Une parcelle du terrain d'une fiche, a une date. */
export type TerrainParcel = {number: string; meterNumber: string | null}

/**
 * Les parcelles d'une fiche a une date (propriete datee, s12) : les periodes
 * demi-ouvertes `[starts_on, ends_on)` qui couvrent le jour — celui de la
 * vente appartient a l'acquereur —, triees par numero.
 */
export const parcelsOwnedOn = (
  periods: readonly OwnershipPeriod[],
  memberProfileId: string,
  date: string
): TerrainParcel[] =>
  periods
    .filter(
      (period) =>
        period.memberProfileId === memberProfileId &&
        period.startsOn <= date &&
        (period.endsOn === null || date < period.endsOn)
    )
    .map(({number, meterNumber}) => ({number, meterNumber}))
    .sort((a, b) => a.number.localeCompare(b.number, 'fr', {numeric: true}))
