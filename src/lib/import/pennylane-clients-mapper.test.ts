import {describe, expect, it} from 'vitest'

import {CsvTable, normalizeHeader} from './csv-reader'
import {mapPennylaneClients} from './pennylane-clients-mapper'

/** L'en-tete d'un export clients Pennylane, reduit aux colonnes utiles. */
const HEADERS = [
  'Identifiant Client',
  'Dénomination',
  'Adresse',
  'Code Postal',
  'Ville',
  'Pays',
  'Liste d’e-mails',
  'Téléphone',
  'Référence Client',
  'Prélèvement : IBAN',
]

type Row = {
  id?: string
  name?: string
  address?: string
  postalCode?: string
  city?: string
  country?: string
  emails?: string
  phone?: string
  reference?: string
}

const LUCIE: Row = {
  id: 'client-fictif-001',
  name: 'Lucie Fictive',
  address: '1 allée des Essais',
  postalCode: '99100',
  city: 'Fictiville',
  country: 'FR',
  emails: 'lucie@exemple.test',
  phone: '06 00 00 00 01',
  reference: 'ZZ 101 - 00XX000001',
}

const toValues = (row: Row): string[] => [
  row.id ?? '',
  row.name ?? '',
  row.address ?? '',
  row.postalCode ?? '',
  row.city ?? '',
  row.country ?? '',
  row.emails ?? '',
  row.phone ?? '',
  row.reference ?? '',
  '',
]

const table = (rows: Row[], headers = HEADERS): CsvTable => ({
  encoding: 'utf-8',
  headers: headers.map(normalizeHeader),
  records: rows.map((row, index) => ({
    line: index + 2,
    values: toValues(row),
    wellFormed: true,
  })),
})

const plan = (rows: Row[]) => {
  const result = mapPennylaneClients(table(rows))
  if (!result.ok) throw new Error('fichier refuse')
  return result.plan
}

describe('mapPennylaneClients — colonnes', () => {
  it('refuse le fichier quand une colonne obligatoire manque, en la nommant', () => {
    const result = mapPennylaneClients(
      table(
        [LUCIE],
        HEADERS.filter((header) => header !== 'Référence Client')
      )
    )

    expect(result).toEqual({
      ok: false,
      reason: 'missing_columns',
      missingColumns: ['Référence Client'],
    })
  })

  it('trouve les colonnes par titre normalisé, quel que soit leur ordre', () => {
    const shuffled = table([LUCIE])
    const result = mapPennylaneClients({
      ...shuffled,
      headers: [...shuffled.headers].reverse(),
      records: shuffled.records.map((record) => ({
        ...record,
        values: [...record.values].reverse(),
      })),
    })

    expect(result.ok && result.plan.members[0].name).toBe('Lucie Fictive')
  })
})

describe('mapPennylaneClients — une ligne valide', () => {
  it('donne un membre, ses coordonnées et sa parcelle', () => {
    expect(plan([LUCIE])).toEqual({
      linesRead: 1,
      members: [
        {
          pennylaneCustomerId: 'client-fictif-001',
          lines: [2],
          name: 'Lucie Fictive',
          email: 'lucie@exemple.test',
          phone: '06 00 00 00 01',
          addressLine: '1 allée des Essais',
          postalCode: '99100',
          city: 'Fictiville',
          parcels: [
            {line: 2, parcelNumber: 'ZZ 101', meterNumber: '00XX000001'},
          ],
        },
      ],
      rejections: [],
      remarks: [],
    })
  })

  it('découpe la référence sur le dernier « - » : une parcelle composée reste entière', () => {
    const [member] = plan([
      {...LUCIE, reference: ' ZZ 215-352 - 00XX000002 '},
    ]).members

    expect(member.parcels).toEqual([
      {line: 2, parcelNumber: 'ZZ 215-352', meterNumber: '00XX000002'},
    ])
  })

  it('garde la référence entière sans compteur quand elle n’a pas de « - », avec une remarque', () => {
    const result = plan([{...LUCIE, reference: 'ZZ 101'}])

    expect(result.members[0].parcels).toEqual([
      {line: 2, parcelNumber: 'ZZ 101'},
    ])
    expect(result.remarks).toEqual([
      {line: 2, client: 'Lucie Fictive', remark: 'no_meter'},
    ])
  })

  it('garde la première adresse email seule, avec une remarque', () => {
    const result = plan([
      {...LUCIE, emails: 'lucie@exemple.test, autre@exemple.test'},
    ])

    expect(result.members[0].email).toBe('lucie@exemple.test')
    expect(result.remarks).toEqual([
      {line: 2, client: 'Lucie Fictive', remark: 'several_emails'},
    ])
  })

  it('remet le zéro initial d’un code postal français à 4 chiffres, avec une remarque', () => {
    const result = plan([{...LUCIE, postalCode: '1100', country: 'FR'}])

    expect(result.members[0].postalCode).toBe('01100')
    expect(result.remarks).toEqual([
      {line: 2, client: 'Lucie Fictive', remark: 'postal_code_padded'},
    ])
  })

  it('laisse tel quel un code postal à 4 chiffres hors de France', () => {
    const result = plan([{...LUCIE, postalCode: '1100', country: 'DE'}])

    expect(result.members[0].postalCode).toBe('1100')
    expect(result.remarks).toEqual([])
  })

  it('crée un membre sans email quand la ligne a une adresse postale (critère 5)', () => {
    const [member] = plan([{...LUCIE, emails: ''}]).members

    expect(member).not.toHaveProperty('email')
    expect(member.addressLine).toBe('1 allée des Essais')
  })

  it('garde une ligne avec un email et sans adresse postale', () => {
    const [member] = plan([
      {...LUCIE, address: '', postalCode: '', city: ''},
    ]).members

    expect(member.email).toBe('lucie@exemple.test')
    expect(member).not.toHaveProperty('addressLine')
  })
})

describe('mapPennylaneClients — rejets ligne à ligne (critères 3 et 6)', () => {
  it.each<[string, Row, string]>([
    ['ni adresse postale ni email', {address: '', emails: ''}, 'no_contact'],
    ['sans nom', {name: ''}, 'missing_name'],
    ['sans identifiant client', {id: ''}, 'missing_customer_id'],
    ['sans référence client', {reference: ''}, 'missing_reference'],
  ])('rejette une ligne %s', (_label, overrides, reason) => {
    const result = plan([{...LUCIE, ...overrides}])

    expect(result.members).toEqual([])
    expect(result.rejections).toEqual([
      {line: 2, client: overrides.name ?? 'Lucie Fictive', reason},
    ])
  })

  it('rejette une ligne mal lue sans arrêter les suivantes', () => {
    const csv = table([LUCIE, {...LUCIE, id: 'client-fictif-002'}])
    const result = mapPennylaneClients({
      ...csv,
      records: [
        {...csv.records[0], values: ['client-fictif-001'], wellFormed: false},
        csv.records[1],
      ],
    })

    expect(result.ok && result.plan.rejections).toEqual([
      {line: 2, client: '', reason: 'malformed_line'},
    ])
    expect(result.ok && result.plan.members).toHaveLength(1)
  })

  it('compte toutes les lignes lues, rejetées comprises', () => {
    expect(plan([LUCIE, {...LUCIE, id: ''}]).linesRead).toBe(2)
  })
})

describe('mapPennylaneClients — regroupement (critère 4 amendé)', () => {
  it('donne un seul membre et plusieurs parcelles pour un même identifiant', () => {
    const result = plan([LUCIE, {...LUCIE, reference: 'ZZ 102 - 00XX000003'}])

    expect(result.members).toHaveLength(1)
    expect(result.members[0].lines).toEqual([2, 3])
    expect(result.members[0].parcels.map((p) => p.parcelNumber)).toEqual([
      'ZZ 101',
      'ZZ 102',
    ])
  })

  it('donne deux membres pour deux identifiants, même nom et même adresse, avec une remarque', () => {
    const result = plan([
      LUCIE,
      {...LUCIE, id: 'client-fictif-002', reference: 'ZZ 102 - 00XX000003'},
    ])

    expect(result.members).toHaveLength(2)
    expect(result.remarks).toEqual([
      {
        line: 3,
        client: 'Lucie Fictive',
        remark: 'same_name_and_address',
        relatedLine: 2,
      },
    ])
  })

  it('ne signale rien pour deux homonymes à des adresses différentes', () => {
    const result = plan([
      LUCIE,
      {...LUCIE, id: 'client-fictif-002', address: '9 impasse du Test'},
    ])

    expect(result.remarks).toEqual([])
  })
})
