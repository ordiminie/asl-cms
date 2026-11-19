import {describe, expect, it} from 'vitest'

import type {
  PennylaneCustomer,
  PennylaneInvoice,
} from '@/lib/pennylane/pennylane-schemas'

import {
  compareTerrain,
  mapPennylaneInvoices,
  parcelsOwnedOn,
  parseInvoiceTerrainLine,
} from './pennylane-invoice-mapping'

/**
 * Regle pure de mappage des factures Pennylane (s20, ADR 062 §2 a §4). Le
 * coeur de la synchronisation : cle de rapprochement, motifs d'ecart,
 * centimes, terrain controle.
 */

const EXTERNAL_REF = '3f2a9c1e-1111-4111-8111-111111111111'
const PROFILE = {id: 'fiche-1', name: 'Bernard Lefèvre'}

const customer = (
  overrides: Partial<PennylaneCustomer> = {}
): PennylaneCustomer => ({
  id: '4211',
  externalReference: EXTERNAL_REF,
  name: 'LEFEVRE Bernard',
  reference: 'AH 6 - 0045821',
  ...overrides,
})

const invoice = (
  overrides: Partial<PennylaneInvoice> = {}
): PennylaneInvoice => ({
  id: '9001',
  invoiceNumber: 'F-2026-0412',
  status: 'late',
  draft: false,
  date: '2026-03-15',
  deadline: '2026-04-15',
  amount: '412.50',
  currency: 'EUR',
  customerId: '4211',
  hasPdf: true,
  freeText: null,
  ...overrides,
})

const map = (
  invoices: PennylaneInvoice[],
  customers: PennylaneCustomer[] = [customer()],
  profiles: ReadonlyMap<string, {id: string; name: string}> = new Map([
    [EXTERNAL_REF, PROFILE],
  ])
) =>
  mapPennylaneInvoices({
    customers,
    invoices,
    profilesByExternalRef: profiles,
  })

const NO_SKIP = {
  draft: 0,
  creditNote: 0,
  noCustomer: 0,
  noDate: 0,
  notEur: 0,
  nonPositive: 0,
  unmatched: 0,
}

describe('mapPennylaneInvoices — rapprochement (ADR 062 §2)', () => {
  it('rattache une facture à la fiche par `customer.id` → `external_reference`', () => {
    const result = map([invoice()])

    expect(result.writes).toEqual([
      {
        externalId: '9001',
        memberProfileId: 'fiche-1',
        invoiceNumber: 'F-2026-0412',
        year: 2026,
        issuedOn: '2026-03-15',
        dueOn: '2026-04-15',
        amountCents: 41250,
        status: 'late',
        hasPdf: true,
        terrain: null,
      },
    ])
    expect(result.skipped).toEqual(NO_SKIP)
    expect(result.unmatchedCustomers).toEqual([])
  })

  it('compare la référence externe sans casse ni espaces de bord', () => {
    const result = map(
      [invoice()],
      [customer({externalReference: ` ${EXTERNAL_REF.toUpperCase()} `})]
    )

    expect(result.writes.map((write) => write.memberProfileId)).toEqual([
      'fiche-1',
    ])
  })

  it('ne rapproche jamais par l’`id` du client', () => {
    const result = map(
      [invoice()],
      [customer({externalReference: null})],
      new Map([['4211', PROFILE]])
    )

    expect(result.writes).toEqual([])
    expect(result.skipped.unmatched).toBe(1)
  })

  it('ne rapproche jamais par la « Référence Client »', () => {
    const result = map(
      [invoice()],
      [customer({externalReference: 'autre', reference: 'AH 6 - 0045821'})],
      new Map([['AH 6 - 0045821', PROFILE]])
    )

    expect(result.writes).toEqual([])
    expect(result.skipped.unmatched).toBe(1)
  })

  it('un client sans fiche : ses factures comptées, le client nommé une fois', () => {
    const result = map(
      [invoice(), invoice({id: '9002', date: '2025-03-15'})],
      [customer({externalReference: 'inconnue'})]
    )

    expect(result.skipped.unmatched).toBe(2)
    expect(result.unmatchedCustomers).toEqual([
      {id: '4211', name: 'LEFEVRE Bernard', reference: 'AH 6 - 0045821'},
    ])
  })

  it('une facture dont le client est absent de `/customers` : non rapprochée, client nommé par son identifiant', () => {
    const result = map([invoice({customerId: '7777'})])

    expect(result.skipped.unmatched).toBe(1)
    expect(result.unmatchedCustomers).toEqual([
      {id: '7777', name: '', reference: null},
    ])
  })
})

describe('mapPennylaneInvoices — écartées, comptées, jamais écrites (ADR 062 §3)', () => {
  it.each([
    ['brouillon', {draft: true}, 'draft'],
    ['avoir', {status: 'credit_note'}, 'creditNote'],
    ['sans client', {customerId: null}, 'noCustomer'],
    ['sans date', {date: null}, 'noDate'],
    ['sans échéance', {deadline: null}, 'noDate'],
    ['date illisible', {date: '15/03/2026'}, 'noDate'],
    ['échéance avant l’émission', {deadline: '2026-03-01'}, 'noDate'],
    ['devise autre que l’euro', {currency: 'USD'}, 'notEur'],
    ['montant nul', {amount: '0.00'}, 'nonPositive'],
    ['montant négatif', {amount: '-12.00'}, 'nonPositive'],
    ['montant à trois décimales', {amount: '12.505'}, 'nonPositive'],
  ] as const)('%s', (_name, overrides, reason) => {
    const result = map([invoice(overrides)])

    expect(result.writes).toEqual([])
    expect(result.skipped).toEqual({...NO_SKIP, [reason]: 1})
  })

  it('un brouillon d’un client sans fiche ne nomme pas ce client', () => {
    const result = map(
      [invoice({draft: true})],
      [customer({externalReference: 'inconnue'})]
    )

    expect(result.unmatchedCustomers).toEqual([])
  })

  it('transporte tout autre statut tel quel, intermédiaires compris', () => {
    const statuses = ['paid', 'partially_paid', 'incomplete', 'cancelled']
    const result = map(
      statuses.map((status, index) => invoice({id: String(index), status}))
    )

    expect(result.writes.map((write) => write.status)).toEqual(statuses)
  })
})

describe('mapPennylaneInvoices — montants et années', () => {
  it.each([
    ['412.50', 41250],
    ['412.5', 41250],
    ['412', 41200],
    ['0.01', 1],
    ['1234567.89', 123456789],
  ])('« %s » → %i centimes exacts', (amount, cents) => {
    expect(map([invoice({amount})]).writes[0]?.amountCents).toBe(cents)
  })

  it('l’année est celle de la date d’émission', () => {
    expect(
      map([invoice({date: '2025-12-31', deadline: '2026-01-31'})]).writes[0]
        ?.year
    ).toBe(2025)
  })
})

describe('parseInvoiceTerrainLine — la ligne « Numero parcelle » (ADR 062 §4)', () => {
  const line = (parcels: string, meter = '0045821') =>
    `Numero parcelle : ${parcels} - Compteur : ${meter} - Index : 120 - Consommation : 35 m3`

  it.each([
    ['AH 6', ['AH 6']],
    ['AH 6-7', ['AH 6', 'AH 7']],
    ['AH 6 B', ['AH 6 B']],
    ['AH 6-7-8', ['AH 6', 'AH 7', 'AH 8']],
    ['AH 6-AH 7', ['AH 6', 'AH 7']],
  ])('« %s »', (parcels, expected) => {
    expect(parseInvoiceTerrainLine(line(parcels))).toEqual({
      parcels: expected,
      meter: '0045821',
    })
  })

  it('compteur vide : aucun compteur', () => {
    expect(parseInvoiceTerrainLine(line('AH 6', ''))).toEqual({
      parcels: ['AH 6'],
      meter: null,
    })
  })

  it('ligne en fin de texte, sans index ni casse attendue', () => {
    expect(
      parseInvoiceTerrainLine('numero PARCELLE : AH 6 - compteur : 0045821')
    ).toEqual({parcels: ['AH 6'], meter: '0045821'})
  })

  it('ligne absente, texte vide ou parcelle vide : aucun contrôle', () => {
    expect(parseInvoiceTerrainLine(null)).toBeNull()
    expect(parseInvoiceTerrainLine('')).toBeNull()
    expect(parseInvoiceTerrainLine('Merci de votre règlement.')).toBeNull()
    expect(parseInvoiceTerrainLine(line(''))).toBeNull()
  })

  it('la facture écrite emporte la ligne lue, jamais le texte libre', () => {
    const [write] = map([invoice({freeText: line('AH 6-7')})]).writes

    expect(write.terrain).toEqual({parcels: ['AH 6', 'AH 7'], meter: '0045821'})
    expect(JSON.stringify(write)).not.toContain('Consommation')
  })
})

describe('compareTerrain — la facture contre la fiche à la date d’émission', () => {
  const fiche = (parcels: {number: string; meterNumber: string | null}[]) =>
    parcels

  it('mêmes parcelles et même compteur : aucun écart', () => {
    expect(
      compareTerrain(
        {parcels: ['AH 6', 'AH 7'], meter: '0045821'},
        fiche([
          {number: 'AH 7', meterNumber: '0045821'},
          {number: 'AH 6', meterNumber: '0045821'},
        ])
      )
    ).toBe(false)
  })

  it('l’abrégé de la fiche importée vaut ses parcelles (« AH 6-7 »)', () => {
    expect(
      compareTerrain(
        {parcels: ['AH 6', 'AH 7'], meter: '0045821'},
        fiche([{number: 'AH 6-7', meterNumber: '0045821'}])
      )
    ).toBe(false)
  })

  it('espaces et casse ne font pas un écart', () => {
    expect(
      compareTerrain(
        {parcels: ['ah  6'], meter: '0045821'},
        fiche([{number: 'AH 6', meterNumber: ' 0045821 '}])
      )
    ).toBe(false)
  })

  it('une autre parcelle : écart', () => {
    expect(
      compareTerrain(
        {parcels: ['AH 7'], meter: '0045821'},
        fiche([{number: 'AH 6', meterNumber: '0045821'}])
      )
    ).toBe(true)
  })

  it('une parcelle de moins : écart', () => {
    expect(
      compareTerrain(
        {parcels: ['AH 6'], meter: '0045821'},
        fiche([
          {number: 'AH 6', meterNumber: '0045821'},
          {number: 'AH 7', meterNumber: '0045821'},
        ])
      )
    ).toBe(true)
  })

  it('un autre compteur : écart', () => {
    expect(
      compareTerrain(
        {parcels: ['AH 6'], meter: '0099999'},
        fiche([{number: 'AH 6', meterNumber: '0045821'}])
      )
    ).toBe(true)
  })

  it('compteur non écrit sur la facture : seules les parcelles comptent', () => {
    expect(
      compareTerrain(
        {parcels: ['AH 6'], meter: null},
        fiche([{number: 'AH 6', meterNumber: '0045821'}])
      )
    ).toBe(false)
  })

  it('fiche sans parcelle à cette date : écart', () => {
    expect(compareTerrain({parcels: ['AH 6'], meter: null}, fiche([]))).toBe(
      true
    )
  })
})

describe('parcelsOwnedOn — le terrain de la fiche à une date (propriété datée, s12)', () => {
  const periods = [
    {
      memberProfileId: 'a',
      number: '13',
      meterNumber: 'M1',
      startsOn: '2020-01-01',
      endsOn: null,
    },
    {
      memberProfileId: 'a',
      number: '12',
      meterNumber: 'M1',
      startsOn: '2020-01-01',
      endsOn: null,
    },
    {
      memberProfileId: 'a',
      number: '27',
      meterNumber: 'M2',
      startsOn: '2018-01-01',
      endsOn: '2026-03-15',
    },
    {
      memberProfileId: 'b',
      number: '27',
      meterNumber: 'M2',
      startsOn: '2026-03-15',
      endsOn: null,
    },
  ]

  it('les périodes demi-ouvertes qui couvrent le jour, triées par numéro', () => {
    expect(parcelsOwnedOn(periods, 'a', '2026-03-14')).toEqual([
      {number: '12', meterNumber: 'M1'},
      {number: '13', meterNumber: 'M1'},
      {number: '27', meterNumber: 'M2'},
    ])
  })

  it('le jour de la vente appartient à l’acquéreur', () => {
    expect(
      parcelsOwnedOn(periods, 'a', '2026-03-15').map((p) => p.number)
    ).toEqual(['12', '13'])
    expect(
      parcelsOwnedOn(periods, 'b', '2026-03-15').map((p) => p.number)
    ).toEqual(['27'])
  })

  it('avant toute période : aucune parcelle', () => {
    expect(parcelsOwnedOn(periods, 'b', '2025-01-01')).toEqual([])
  })
})
