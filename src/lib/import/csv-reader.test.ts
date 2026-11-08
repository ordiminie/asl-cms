import {describe, expect, it} from 'vitest'

import {normalizeHeader, readCsv} from './csv-reader'

/** Encode en Windows-1252 les seuls caracteres des fixtures. */
const WINDOWS_1252: Record<string, number> = {
  '’': 0x92,
  é: 0xe9,
  è: 0xe8,
  ô: 0xf4,
  ç: 0xe7,
}
const toWindows1252 = (text: string): Uint8Array =>
  Uint8Array.from(
    [...text].map((char) => WINDOWS_1252[char] ?? char.charCodeAt(0))
  )

const toUtf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

const ok = (bytes: Uint8Array) => {
  const result = readCsv(bytes)
  if (!result.ok) throw new Error(`lecture refusee : ${result.reason}`)
  return result.table
}

describe('readCsv — dialecte virgule et Windows-1252', () => {
  const bytes = toWindows1252(
    'Dénomination,Liste d’e-mails,Ville\r\n' +
      'Lucie Fictive,lucie@exemple.test,Hôpital-sur-Mer\r\n' +
      'Marc Inventé,,Saint-Fictif\r\n'
  )

  it('décode les accents et l’apostrophe typographique', () => {
    const table = ok(bytes)

    expect(table.encoding).toBe('windows-1252')
    expect(table.records[0].values).toEqual([
      'Lucie Fictive',
      'lucie@exemple.test',
      'Hôpital-sur-Mer',
    ])
    expect(table.records[1].values[0]).toBe('Marc Inventé')
  })

  it('normalise les en-têtes (casse, apostrophe)', () => {
    expect(ok(bytes).headers).toEqual([
      'dénomination',
      "liste d'e-mails",
      'ville',
    ])
  })

  it('numérote les lignes comme le tableur : en-tête = ligne 1', () => {
    expect(ok(bytes).records.map((record) => record.line)).toEqual([2, 3])
  })
})

describe('readCsv — dialecte point-virgule et UTF-8', () => {
  it('détecte le séparateur et l’encodage, ignore le BOM', () => {
    const table = ok(
      toUtf8('﻿"Dénomination";"Ville"\n"Lucie Fictive";"Hôpital-sur-Mer"\n')
    )

    expect(table.encoding).toBe('utf-8')
    expect(table.headers).toEqual(['dénomination', 'ville'])
    expect(table.records).toEqual([
      {line: 2, values: ['Lucie Fictive', 'Hôpital-sur-Mer'], wellFormed: true},
    ])
  })

  it('détecte la tabulation', () => {
    expect(ok(toUtf8('a\tb\n1\t2\n')).records[0].values).toEqual(['1', '2'])
  })

  it('normalise les espaces insécables des en-têtes', () => {
    expect(ok(toUtf8('Prélèvement : Mandat ; Ville\n1;2\n')).headers).toEqual([
      'prélèvement : mandat',
      'ville',
    ])
  })
})

describe('readCsv — guillemets', () => {
  it('garde une cellule à virgules entre guillemets', () => {
    const table = ok(
      toUtf8(
        'Nom,Emails\r\n"Lucie Fictive","a@exemple.test, b@exemple.test"\r\n'
      )
    )

    expect(table.records[0].values).toEqual([
      'Lucie Fictive',
      'a@exemple.test, b@exemple.test',
    ])
  })

  it('lit les guillemets doublés et les retours à la ligne dans une cellule', () => {
    const table = ok(
      toUtf8('Nom,Note\n"Le ""Clos"" fictif","ligne 1\nligne 2"\nSuite,ok\n')
    )

    expect(table.records[0].values).toEqual([
      'Le "Clos" fictif',
      'ligne 1\nligne 2',
    ])
    expect(table.records[1]).toMatchObject({line: 3, values: ['Suite', 'ok']})
  })

  it('refuse un guillemet jamais refermé', () => {
    expect(readCsv(toUtf8('Nom,Note\n"ouvert,x\n'))).toEqual({
      ok: false,
      reason: 'unclosed_quote',
    })
  })
})

describe('readCsv — lignes', () => {
  it('signale une ligne de longueur fausse sans arrêter les suivantes', () => {
    const table = ok(toUtf8('a;b;c\n1;2\n4;5;6\n'))

    expect(table.records).toEqual([
      {line: 2, values: ['1', '2'], wellFormed: false},
      {line: 3, values: ['4', '5', '6'], wellFormed: true},
    ])
  })

  it('ignore les lignes vides, au milieu comme à la fin', () => {
    const table = ok(toUtf8('a;b\n1;2\n\n;\n3;4\n\n'))

    expect(table.records.map((record) => record.values)).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })
})

describe('readCsv — fichiers refusés', () => {
  it('refuse un fichier vide', () => {
    expect(readCsv(new Uint8Array())).toEqual({ok: false, reason: 'empty'})
    expect(readCsv(toUtf8(' \r\n\n'))).toEqual({ok: false, reason: 'empty'})
  })

  it('refuse un fichier sans en-têtes', () => {
    expect(readCsv(toUtf8(';;\n1;2;3\n'))).toEqual({
      ok: false,
      reason: 'no_headers',
    })
  })

  it('refuse un fichier binaire', () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ])

    expect(readCsv(png)).toEqual({ok: false, reason: 'binary'})
  })
})

describe('normalizeHeader', () => {
  it.each([
    ['  Liste d’e-mails ', "liste d'e-mails"],
    ['Code  Postal', 'code postal'],
    ['IDENTIFIANT Client', 'identifiant client'],
  ])('« %s » → « %s »', (input, expected) => {
    expect(normalizeHeader(input)).toBe(expected)
  })
})
