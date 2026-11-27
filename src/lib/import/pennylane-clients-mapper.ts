import {sameNameAndHomeKeyOf} from '@/services/rules/campaign-letter-rules'
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
 * ADR 047 et 048). Fonctions pures : aucune ecriture, aucune horloge.
 *
 * La table de correspondance des colonnes vit ici, pas dans le service : s17
 * reutilisera le lecteur avec son propre mappage. Les colonnes bancaires ne
 * sont jamais lues.
 *
 * Domicile et terrain (s55, ADR 058, arbitrage du 17/11/2026) : l'`Adresse`
 * est le domicile, sauf quand l'`Adresse de Livraison` est renseignee — la
 * livraison devient le domicile et l'`Adresse` le terrain. Le terrain par
 * defaut d'une fiche sans terrain est un parametre, applique par le service :
 * aucun parametre n'est lu ici.
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
  deliveryAddressLine: {title: 'Adresse de Livraison', required: false},
  deliveryPostalCode: {title: 'Code Postal de Livraison', required: false},
  deliveryCity: {title: 'Ville de Livraison', required: false},
  deliveryCountry: {title: 'Pays de Livraison', required: false},
  clientType: {title: 'Type de Client', required: false},
} as const

type ColumnKey = keyof typeof PENNYLANE_COLUMNS
type ColumnIndexes = Partial<Record<ColumnKey, number>>

/** Separateur parcelle / compteur dans la `Reference Client`. */
const REFERENCE_SEPARATOR = ' - '
const EMAIL_SEPARATOR = /[,;\s]+/
const FRANCE = 'FR'
const FOUR_DIGITS = /^\d{4}$/
/** Valeur de `Type de Client` qui designe une entreprise (recherche s55). */
const COMPANY_CLIENT_TYPE = 'entreprise'

/**
 * `initial` (s13, defaut) : creation des fiches et de leurs parcelles.
 * `annual` (s56) : mise a jour des coordonnees seulement ; la `Reference
 * Client` n'est ni requise ni lue, aucune parcelle n'est calculee.
 */
export type PennylaneMappingMode = 'initial' | 'annual'

export type PennylaneMappingOptions = {mode?: PennylaneMappingMode}

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
  parcel: ImportParcelCandidate | undefined
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

const isRequired = (key: ColumnKey, mode: PennylaneMappingMode): boolean =>
  PENNYLANE_COLUMNS[key].required && !(mode === 'annual' && key === 'reference')

const missingColumnsOf = (
  indexes: ColumnIndexes,
  mode: PennylaneMappingMode
): string[] =>
  (Object.keys(PENNYLANE_COLUMNS) as ColumnKey[])
    .filter((key) => isRequired(key, mode) && indexes[key] === undefined)
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

/**
 * Toutes les adresses de la cellule (s54, critere 11), dans leur ordre,
 * dedoublonnees sans casse : la premiere sera la titulaire d'une fiche
 * creee, les suivantes ses supplementaires.
 */
const cellEmails = (emails: string): {email: string; others: string[]} => {
  const all = emails
    .split(EMAIL_SEPARATOR)
    .map((email) => email.trim())
    .filter(Boolean)
  const unique = all.filter(
    (email, index) =>
      all.findIndex((other) => other.toLowerCase() === email.toLowerCase()) ===
      index
  )
  return {email: unique[0] ?? '', others: unique.slice(1)}
}

const padPostalCode = (
  postalCode: string,
  country: string
): {postalCode: string; padded: boolean} =>
  FOUR_DIGITS.test(postalCode) && country.toUpperCase() === FRANCE
    ? {postalCode: `0${postalCode}`, padded: true}
    : {postalCode, padded: false}

/** Une adresse postale lue dans le fichier, code postal complete. */
type FileAddress = {
  addressLine: string
  postalCode: string
  city: string
  padded: boolean
}

const fileAddressOf = (
  cell: (key: ColumnKey) => string,
  columns: {
    addressLine: ColumnKey
    postalCode: ColumnKey
    city: ColumnKey
    country: ColumnKey
  }
): FileAddress => {
  const {postalCode, padded} = padPostalCode(
    cell(columns.postalCode),
    cell(columns.country)
  )
  return {
    addressLine: cell(columns.addressLine),
    postalCode,
    city: cell(columns.city),
    padded,
  }
}

const MAIN_ADDRESS_COLUMNS = {
  addressLine: 'addressLine',
  postalCode: 'postalCode',
  city: 'city',
  country: 'country',
} as const

const DELIVERY_ADDRESS_COLUMNS = {
  addressLine: 'deliveryAddressLine',
  postalCode: 'deliveryPostalCode',
  city: 'deliveryCity',
  country: 'deliveryCountry',
} as const

/**
 * Domicile et terrain d'une ligne (arbitrage du 17/11/2026) : une livraison
 * renseignee est le domicile, l'adresse principale le terrain ; sinon
 * l'adresse principale est le domicile, sans terrain.
 */
const homeAndLandOf = (
  cell: (key: ColumnKey) => string
): {home: FileAddress; land: FileAddress | undefined} => {
  const main = fileAddressOf(cell, MAIN_ADDRESS_COLUMNS)
  if (!cell('deliveryAddressLine')) return {home: main, land: undefined}
  return {home: fileAddressOf(cell, DELIVERY_ADDRESS_COLUMNS), land: main}
}

const isCompany = (cell: (key: ColumnKey) => string): boolean =>
  cell('clientType').toLowerCase() === COMPANY_CLIENT_TYPE

const rejectionOf = (
  cell: (key: ColumnKey) => string,
  record: CsvRecord,
  mode: PennylaneMappingMode
): ImportRejection | undefined => {
  if (!record.wellFormed) return ImportRejectionConst.MALFORMED_LINE
  if (!cell('customerId')) return ImportRejectionConst.MISSING_CUSTOMER_ID
  if (!cell('name')) return ImportRejectionConst.MISSING_NAME
  if (!homeAndLandOf(cell).home.addressLine && !cell('emails')) {
    return ImportRejectionConst.NO_CONTACT
  }
  if (mode === 'initial' && !cell('reference')) {
    return ImportRejectionConst.MISSING_REFERENCE
  }
  return undefined
}

const parseLine = (
  record: CsvRecord,
  indexes: ColumnIndexes,
  mode: PennylaneMappingMode
): LineOutcome => {
  const cell = cellOf(record, indexes)
  const client = record.wellFormed ? cell('name') : ''
  const reason = rejectionOf(cell, record, mode)
  if (reason) {
    return {ok: false, rejection: {line: record.line, client, reason}}
  }

  const {email, others} = cellEmails(cell('emails'))
  const {home, land} = homeAndLandOf(cell)
  const padded = home.padded || (land?.padded ?? false)
  const parcel =
    mode === 'initial'
      ? splitReference(record.line, cell('reference'))
      : undefined
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
        ...(others.length > 0 ? {additionalEmails: others} : {}),
        ...present('phone', cell('phone')),
        ...present('homeAddressLine', home.addressLine),
        ...present('homePostalCode', home.postalCode),
        ...present('homeCity', home.city),
        ...present('landAddressLine', land?.addressLine ?? ''),
        ...present('landPostalCode', land?.postalCode ?? ''),
        ...present('landCity', land?.city ?? ''),
        ...present('companyName', isCompany(cell) ? client : ''),
      },
      parcel,
      remarks: [
        ...(padded ? [remark(ImportRemarkConst.POSTAL_CODE_PADDED)] : []),
        ...(!parcel || parcel.meterNumber
          ? []
          : [remark(ImportRemarkConst.NO_METER)]),
      ],
    },
  }
}

const parcelsOf = (line: ParsedLine): ImportParcelCandidate[] =>
  line.parcel ? [line.parcel] : []

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
            parcels: [...group.parcels, ...parcelsOf(line)],
          }
        : {
            pennylaneCustomerId: line.customerId,
            lines: [line.line],
            ...line.member,
            parcels: parcelsOf(line),
          }
    )
  }
  return [...groups.values()]
}

const nameAndAddressKey = (line: ParsedLine): string =>
  sameNameAndHomeKeyOf(
    line.member.name,
    line.member.homeAddressLine,
    line.member.homePostalCode
  )

/**
 * Deux identifiants differents, meme nom et meme domicile : deux membres, et
 * une remarque. Jamais de fusion d'office (story, ADR 048). Le domicile, pas
 * le terrain (s55) : s28 s'appuie sur la meme comparaison.
 */
const sameNameAndAddressRemarks = (lines: ParsedLine[]): ImportRemarkDTO[] => {
  const firstSeen = new Map<string, ParsedLine>()
  return lines.flatMap((line) => {
    if (!line.member.homeAddressLine) return []
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
  table: CsvTable,
  {mode = 'initial'}: PennylaneMappingOptions = {}
): PennylaneMappingResult => {
  const indexes = indexColumns(table.headers)
  const missingColumns = missingColumnsOf(indexes, mode)
  if (missingColumns.length > 0) {
    return {ok: false, reason: 'missing_columns', missingColumns}
  }

  const outcomes = table.records.map((record) =>
    parseLine(record, indexes, mode)
  )
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
