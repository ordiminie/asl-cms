import {
  ImportMemberCandidate,
  ImportParcelCandidate,
  ImportPlan,
  ImportRejection,
  ImportRejectionConst,
  ImportRejectionDTO,
  ImportRemarkConst,
  ImportRemarkDTO,
} from '@/services/types/domain/member-import-types'

import {CsvRecord, CsvTable, normalizeHeader} from './csv-reader'

/**
 * Mappage d'un export clients Pennylane vers les membres a importer (s13,
 * ADR 046 et 047). Fonctions pures : aucune ecriture, aucune horloge.
 *
 * La table de correspondance des colonnes vit ici, pas dans le service : s17
 * reutilisera le lecteur avec son propre mappage. Les colonnes bancaires ne
 * sont jamais lues.
 */

/** Titres des colonnes de l'export, tels que Pennylane les ecrit. */
const PENNYLANE_COLUMNS = {
  customerId: {title: 'Identifiant Client', required: true},
  name: {title: 'Dénomination', required: true},
  reference: {title: 'Référence Client', required: true},
  emails: {title: 'Liste d’e-mails', required: true},
  addressLine: {title: 'Adresse', required: true},
  postalCode: {title: 'Code Postal', required: true},
  city: {title: 'Ville', required: true},
  country: {title: 'Pays', required: false},
  phone: {title: 'Téléphone', required: false},
} as const

type ColumnKey = keyof typeof PENNYLANE_COLUMNS
type ColumnIndexes = Partial<Record<ColumnKey, number>>

/** Separateur parcelle / compteur dans la `Reference Client`. */
const REFERENCE_SEPARATOR = ' - '
const EMAIL_SEPARATOR = /[,;\s]+/
const FRANCE = 'FR'
const FOUR_DIGITS = /^\d{4}$/

export type PennylaneMappingResult =
  | {ok: true; plan: ImportPlan}
  | {ok: false; reason: 'missing_columns'; missingColumns: string[]}

type ParsedLine = {
  line: number
  customerId: string
  member: Omit<
    ImportMemberCandidate,
    'pennylaneCustomerId' | 'lines' | 'parcels'
  >
  parcel: ImportParcelCandidate
  remarks: ImportRemarkDTO[]
}

type LineOutcome =
  {ok: true; parsed: ParsedLine} | {ok: false; rejection: ImportRejectionDTO}

const indexColumns = (headers: string[]): ColumnIndexes =>
  Object.fromEntries(
    (Object.keys(PENNYLANE_COLUMNS) as ColumnKey[]).flatMap((key) => {
      const index = headers.indexOf(
        normalizeHeader(PENNYLANE_COLUMNS[key].title)
      )
      return index === -1 ? [] : [[key, index]]
    })
  )

const missingColumnsOf = (indexes: ColumnIndexes): string[] =>
  (Object.keys(PENNYLANE_COLUMNS) as ColumnKey[])
    .filter(
      (key) => PENNYLANE_COLUMNS[key].required && indexes[key] === undefined
    )
    .map((key) => PENNYLANE_COLUMNS[key].title)

const cellOf =
  (record: CsvRecord, indexes: ColumnIndexes) => (key: ColumnKey) => {
    const index = indexes[key]
    return index === undefined ? '' : (record.values[index] ?? '').trim()
  }

/** Une valeur absente n'est pas ecrite : la cle disparait de l'objet. */
const present = <K extends string>(key: K, value: string) =>
  (value ? {[key]: value} : {}) as Partial<Record<K, string>>

const splitReference = (
  line: number,
  reference: string
): ImportParcelCandidate => {
  const cut = reference.lastIndexOf(REFERENCE_SEPARATOR)
  if (cut === -1) return {line, parcelNumber: reference}
  return {
    line,
    parcelNumber: reference.slice(0, cut).trim(),
    ...present(
      'meterNumber',
      reference.slice(cut + REFERENCE_SEPARATOR.length).trim()
    ),
  }
}

const firstEmail = (emails: string): {email: string; several: boolean} => {
  const all = emails.split(EMAIL_SEPARATOR).filter(Boolean)
  return {email: all[0] ?? '', several: all.length > 1}
}

const padPostalCode = (
  postalCode: string,
  country: string
): {postalCode: string; padded: boolean} =>
  FOUR_DIGITS.test(postalCode) && country.toUpperCase() === FRANCE
    ? {postalCode: `0${postalCode}`, padded: true}
    : {postalCode, padded: false}

const rejectionOf = (
  cell: (key: ColumnKey) => string,
  record: CsvRecord
): ImportRejection | undefined => {
  if (!record.wellFormed) return ImportRejectionConst.MALFORMED_LINE
  if (!cell('customerId')) return ImportRejectionConst.MISSING_CUSTOMER_ID
  if (!cell('name')) return ImportRejectionConst.MISSING_NAME
  if (!cell('addressLine') && !cell('emails')) {
    return ImportRejectionConst.NO_CONTACT
  }
  if (!cell('reference')) return ImportRejectionConst.MISSING_REFERENCE
  return undefined
}

const parseLine = (record: CsvRecord, indexes: ColumnIndexes): LineOutcome => {
  const cell = cellOf(record, indexes)
  const client = record.wellFormed ? cell('name') : ''
  const reason = rejectionOf(cell, record)
  if (reason) {
    return {ok: false, rejection: {line: record.line, client, reason}}
  }

  const {email, several} = firstEmail(cell('emails'))
  const {postalCode, padded} = padPostalCode(
    cell('postalCode'),
    cell('country')
  )
  const parcel = splitReference(record.line, cell('reference'))
  const remark = (code: ImportRemarkDTO['remark']): ImportRemarkDTO => ({
    line: record.line,
    client,
    remark: code,
  })

  return {
    ok: true,
    parsed: {
      line: record.line,
      customerId: cell('customerId'),
      member: {
        name: client,
        ...present('email', email),
        ...present('phone', cell('phone')),
        ...present('addressLine', cell('addressLine')),
        ...present('postalCode', postalCode),
        ...present('city', cell('city')),
      },
      parcel,
      remarks: [
        ...(several ? [remark(ImportRemarkConst.SEVERAL_EMAILS)] : []),
        ...(padded ? [remark(ImportRemarkConst.POSTAL_CODE_PADDED)] : []),
        ...(parcel.meterNumber ? [] : [remark(ImportRemarkConst.NO_METER)]),
      ],
    },
  }
}

/** Meme identifiant client → un seul membre, une parcelle par ligne. */
const groupByCustomer = (lines: ParsedLine[]): ImportMemberCandidate[] => {
  const groups = new Map<string, ImportMemberCandidate>()
  for (const line of lines) {
    const group = groups.get(line.customerId)
    groups.set(
      line.customerId,
      group
        ? {
            ...group,
            lines: [...group.lines, line.line],
            parcels: [...group.parcels, line.parcel],
          }
        : {
            pennylaneCustomerId: line.customerId,
            lines: [line.line],
            ...line.member,
            parcels: [line.parcel],
          }
    )
  }
  return [...groups.values()]
}

const nameAndAddressKey = (line: ParsedLine): string =>
  [
    line.member.name,
    line.member.addressLine ?? '',
    line.member.postalCode ?? '',
  ]
    .map((part) => part.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|')

/**
 * Deux identifiants differents, meme nom et meme adresse : deux membres, et une
 * remarque. Jamais de fusion d'office (story, ADR 046).
 */
const sameNameAndAddressRemarks = (lines: ParsedLine[]): ImportRemarkDTO[] => {
  const firstSeen = new Map<string, ParsedLine>()
  return lines.flatMap((line) => {
    if (!line.member.addressLine) return []
    const key = nameAndAddressKey(line)
    const earlier = firstSeen.get(key)
    if (!earlier) {
      firstSeen.set(key, line)
      return []
    }
    if (earlier.customerId === line.customerId) return []
    return [
      {
        line: line.line,
        client: line.member.name,
        remark: ImportRemarkConst.SAME_NAME_AND_ADDRESS,
        relatedLine: earlier.line,
      },
    ]
  })
}

/** Les membres a importer, les lignes rejetees et les remarques du fichier. */
export const mapPennylaneClients = (
  table: CsvTable
): PennylaneMappingResult => {
  const indexes = indexColumns(table.headers)
  const missingColumns = missingColumnsOf(indexes)
  if (missingColumns.length > 0) {
    return {ok: false, reason: 'missing_columns', missingColumns}
  }

  const outcomes = table.records.map((record) => parseLine(record, indexes))
  const parsed = outcomes.flatMap((outcome) =>
    outcome.ok ? [outcome.parsed] : []
  )

  return {
    ok: true,
    plan: {
      linesRead: table.records.length,
      members: groupByCustomer(parsed),
      rejections: outcomes.flatMap((outcome) =>
        outcome.ok ? [] : [outcome.rejection]
      ),
      remarks: [
        ...parsed.flatMap((line) => line.remarks),
        ...sameNameAndAddressRemarks(parsed),
      ].sort((a, b) => a.line - b.line),
    },
  }
}
