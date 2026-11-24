import {describe, expect, it} from 'vitest'

import {
  dueReminderRankOf,
  formatReminderDay,
  formatUnpaidInvoicesList,
  plannedReminderDayOf,
  reminderSubmissionIdOf,
  substituteInvoicesList,
  unpaidDueDatesOf,
  unpaidProfileIdsForDueOn,
} from './unpaid-reminder-rules'

const DUE_ON = '2026-03-31'
const DELAYS = [3, 2, 1]
const CLASSIFICATION = {unpaid: ['En attente'], settled: ['Payée']}

const finished = (rank: number, sentOn: string) => ({
  rank,
  finished: true,
  sentOn,
})

describe('dueReminderRankOf — calage « une à la fois » (ADR 070 §5)', () => {
  it('calendrier ponctuel : R1 à échéance + 3 sem., R2 à + 5, R3 à + 6', () => {
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [],
        today: '2026-04-20',
      })
    ).toBeNull()
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [],
        today: '2026-04-21',
      })
    ).toBe(1)

    const afterR1 = [finished(1, '2026-04-21')]
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: afterR1,
        today: '2026-05-04',
      })
    ).toBeNull()
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: afterR1,
        today: '2026-05-05',
      })
    ).toBe(2)

    const afterR2 = [...afterR1, finished(2, '2026-05-05')]
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: afterR2,
        today: '2026-05-11',
      })
    ).toBeNull()
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: afterR2,
        today: '2026-05-12',
      })
    ).toBe(3)
  })

  it('activation tardive : un seul rang à la fois, le premier d’abord', () => {
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [],
        today: '2026-06-30',
      })
    ).toBe(1)
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [finished(1, '2026-06-30')],
        today: '2026-06-30',
      })
    ).toBeNull()
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [finished(1, '2026-06-30')],
        today: '2026-07-14',
      })
    ).toBe(2)
  })

  it('rang précédent non terminé : rien de dû', () => {
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [{rank: 1, finished: false, sentOn: null}],
        today: '2026-09-01',
      })
    ).toBeNull()
  })

  it('report de R1 de 3 jours : R2 décalé d’autant', () => {
    const ranks = [finished(1, '2026-04-24')]
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks,
        today: '2026-05-07',
      })
    ).toBeNull()
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks,
        today: '2026-05-08',
      })
    ).toBe(2)
    expect(
      plannedReminderDayOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        rank: 2,
        previousSentOn: '2026-04-24',
      })
    ).toBe('2026-05-08')
  })

  it('un rang terminé sans envoi réel garde la date théorique', () => {
    expect(
      plannedReminderDayOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        rank: 2,
        previousSentOn: null,
      })
    ).toBe('2026-05-05')
  })

  it('rang 3 créé : plus rien', () => {
    expect(
      dueReminderRankOf({
        dueOn: DUE_ON,
        delays: DELAYS,
        ranks: [
          finished(1, '2026-04-21'),
          finished(2, '2026-05-05'),
          finished(3, '2026-05-12'),
        ],
        today: '2027-01-01',
      })
    ).toBeNull()
  })
})

describe('unpaidProfileIdsForDueOn — cible propre à l’échéance (ADR 070 §2)', () => {
  const invoices = [
    {memberProfileId: 'a', status: 'En attente', dueOn: DUE_ON},
    {memberProfileId: 'b', status: 'Payée', dueOn: DUE_ON},
    {memberProfileId: 'c', status: 'Relance 1', dueOn: DUE_ON},
    {memberProfileId: 'd', status: 'En attente', dueOn: '2025-03-31'},
    {memberProfileId: 'e', status: ' En attente ', dueOn: DUE_ON},
  ]

  it('seuls les impayés de cette échéance ; un statut à classer n’est jamais impayé', () => {
    expect([
      ...unpaidProfileIdsForDueOn(invoices, CLASSIFICATION, DUE_ON),
    ]).toEqual(['a', 'e'])
  })

  it('deux échéances distinctes sont indépendantes', () => {
    expect([
      ...unpaidProfileIdsForDueOn(invoices, CLASSIFICATION, '2025-03-31'),
    ]).toEqual(['d'])
    expect(unpaidDueDatesOf(invoices, CLASSIFICATION)).toEqual([
      '2025-03-31',
      DUE_ON,
    ])
  })
})

describe('formatUnpaidInvoicesList — la variable {factures} (ADR 070 §9)', () => {
  it('une puce Markdown par facture, montant et date formatés', () => {
    expect(
      formatUnpaidInvoicesList(
        [
          {
            subject: 'Facture 2026',
            parcelNumber: '12',
            amountCents: 32000,
            dueOn: DUE_ON,
          },
          {
            subject: 'Facture 2026',
            parcelNumber: null,
            amountCents: 123456,
            dueOn: DUE_ON,
          },
        ],
        ({subject, parcelNumber, amount, dueOn}) =>
          `${subject}${parcelNumber ? `, parcelle ${parcelNumber}` : ''} : ${amount} €, avant le ${dueOn}`
      )
    ).toBe(
      '- Facture 2026, parcelle 12 : 320,00 €, avant le 31/03/2026\n- Facture 2026 : 1\u202f234,56 €, avant le 31/03/2026'
    )
  })

  it('formatReminderDay écrit jj/mm/aaaa', () => {
    expect(formatReminderDay('2026-04-05')).toBe('05/04/2026')
  })
})

describe('reminderSubmissionIdOf — soumission déterministe (ADR 070 §6)', () => {
  const ORG = '0b5c3f2e-7a8d-4c1e-9f6a-2d3b4c5e6f70'

  it('est stable, et distincte par association, échéance et rang', () => {
    const id = reminderSubmissionIdOf(ORG, DUE_ON, 1)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(reminderSubmissionIdOf(ORG, DUE_ON, 1)).toBe(id)
    expect(reminderSubmissionIdOf(ORG, DUE_ON, 2)).not.toBe(id)
    expect(reminderSubmissionIdOf(ORG, '2025-03-31', 1)).not.toBe(id)
    expect(
      reminderSubmissionIdOf('5a2f1c3d-4b6e-4f70-8a9b-0c1d2e3f4a5b', DUE_ON, 1)
    ).not.toBe(id)
  })
})

describe('substituteInvoicesList — {factures} remplacée avant le rendu Markdown', () => {
  it('remplace chaque occurrence, laisse les autres variables', () => {
    expect(
      substituteInvoicesList(
        'Bonjour {nom},\n\n{factures}\n\n{factures}',
        '- a\n- b'
      )
    ).toBe('Bonjour {nom},\n\n- a\n- b\n\n- a\n- b')
  })
})
