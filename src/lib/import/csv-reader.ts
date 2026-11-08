/**
 * Lecteur CSV du motif d'import (s13, ADR 047) : fonctions pures, sans
 * dependance. Un fichier illisible est refuse avec sa cause, jamais lu de
 * travers.
 *
 * - Decodage UTF-8 strict, repli Windows-1252 (export d'un tableur francais).
 * - BOM ignore ; separateur detecte sur la ligne d'en-tetes (`;`, `,`, tab).
 * - Guillemets, guillemets doubles et retours a la ligne dans une cellule.
 * - En-tetes normalises (espaces insecables, apostrophes, casse).
 */

export type CsvEncoding = 'utf-8' | 'windows-1252'

/** Une ligne du fichier, numerotee comme le tableur : en-tete = ligne 1. */
export type CsvRecord = {
  line: number
  values: string[]
  /** Autant de cellules que d'en-tetes : sinon la ligne est mal lue. */
  wellFormed: boolean
}

export type CsvTable = {
  encoding: CsvEncoding
  /** En-tetes normalises (`normalizeHeader`), dans l'ordre du fichier. */
  headers: string[]
  records: CsvRecord[]
}

export type CsvReadFailure =
  'empty' | 'binary' | 'no_headers' | 'unclosed_quote'

export type CsvReadResult =
  {ok: true; table: CsvTable} | {ok: false; reason: CsvReadFailure}

const SEPARATORS = [';', ',', '\t'] as const
const BOM = '﻿'
const QUOTE = '"'

/**
 * Un titre de colonne comparable : espaces insecables et suites d'espaces
 * reduits a un espace, apostrophes typographiques droites, minuscules.
 */
export const normalizeHeader = (header: string): string =>
  header
    .normalize('NFC')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** Un octet nul ne se trouve dans aucun texte : c'est un fichier binaire. */
const isBinary = (bytes: Uint8Array): boolean => bytes.includes(0)

const decode = (bytes: Uint8Array): {text: string; encoding: CsvEncoding} => {
  try {
    return {
      text: new TextDecoder('utf-8', {fatal: true}).decode(bytes),
      encoding: 'utf-8',
    }
  } catch {
    return {
      text: new TextDecoder('windows-1252').decode(bytes),
      encoding: 'windows-1252',
    }
  }
}

/** La premiere ligne physique, hors guillemets, pour y compter les separateurs. */
const firstLine = (text: string): string => {
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === QUOTE) inQuotes = !inQuotes
    else if (!inQuotes && (char === '\n' || char === '\r')) {
      return text.slice(0, index)
    }
  }
  return text
}

const countOutsideQuotes = (line: string, separator: string): number => {
  let inQuotes = false
  let count = 0
  for (const char of line) {
    if (char === QUOTE) inQuotes = !inQuotes
    else if (!inQuotes && char === separator) count += 1
  }
  return count
}

/** Le separateur le plus frequent de la ligne d'en-tetes ; `,` a defaut. */
const detectSeparator = (text: string): string => {
  const header = firstLine(text)
  const [best] = [...SEPARATORS].sort(
    (a, b) => countOutsideQuotes(header, b) - countOutsideQuotes(header, a)
  )
  return countOutsideQuotes(header, best) > 0 ? best : ','
}

type ParsedRecords = {rows: string[][]} | {unclosedQuote: true}

/**
 * Decoupe le texte en enregistrements (RFC 4180 tolerant) : CRLF ou LF, une
 * cellule entre guillemets peut contenir separateur, retour a la ligne et
 * guillemet double.
 */
const parseRecords = (text: string, separator: string): ParsedRecords => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char !== QUOTE) cell += char
      else if (text[index + 1] === QUOTE) {
        cell += QUOTE
        index += 1
      } else inQuotes = false
    } else if (char === QUOTE) inQuotes = true
    else if (char === separator) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      rows.push([...row, cell])
      row = []
      cell = ''
    } else cell += char
  }

  if (inQuotes) return {unclosedQuote: true}
  if (cell !== '' || row.length > 0) rows.push([...row, cell])
  return {rows}
}

const isBlank = (values: string[]): boolean =>
  values.every((value) => value.trim() === '')

const toRecords = (rows: string[][], headerCount: number): CsvRecord[] =>
  rows.flatMap((values, index) =>
    isBlank(values)
      ? []
      : [
          {
            line: index + 2,
            values: values.map((value) => value.trim()),
            wellFormed: values.length === headerCount,
          },
        ]
  )

/** Lit un fichier CSV televerse ; refuse avec sa cause ce qu'il ne lit pas. */
export const readCsv = (bytes: Uint8Array): CsvReadResult => {
  if (isBinary(bytes)) return {ok: false, reason: 'binary'}

  const decoded = decode(bytes)
  const text = decoded.text.startsWith(BOM)
    ? decoded.text.slice(BOM.length)
    : decoded.text
  if (text.trim() === '') return {ok: false, reason: 'empty'}

  const parsed = parseRecords(text, detectSeparator(text))
  if ('unclosedQuote' in parsed) return {ok: false, reason: 'unclosed_quote'}

  const [headerRow, ...dataRows] = parsed.rows
  const headers = headerRow.map(normalizeHeader)
  if (headers.every((header) => header === '')) {
    return {ok: false, reason: 'no_headers'}
  }

  return {
    ok: true,
    table: {
      encoding: decoded.encoding,
      headers,
      records: toRecords(dataRows, headers.length),
    },
  }
}
