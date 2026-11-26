import {describe, expect, it} from 'vitest'

import {
  AnnualCurrentContact,
  AnnualEmailOperation,
  AnnualEmailPlanInput,
  AnnualEmailRow,
  AnnualFileContact,
  PennylaneImportSnapshot,
} from '../types/domain/member-annual-import-types'
import {
  planAnnualContactUpdate,
  planAnnualEmailUpdate,
} from './member-annual-import-rules'
import {planEmailRemoval} from './member-email-rules'

const HOME_A = {
  line: '1 allée des Essais',
  postalCode: '99100',
  city: 'Fictiville',
}
const HOME_B = {line: '2 rue du Test', postalCode: '99200', city: 'Testbourg'}
const HOME_C = {line: '3 chemin Neuf', postalCode: '99300', city: 'Neufville'}
const LAND_A = {line: 'Lot 12', postalCode: '99400', city: 'Terrainville'}
const LAND_B = {line: 'Lot 14', postalCode: '99400', city: 'Terrainville'}

const current = (
  overrides: Partial<AnnualCurrentContact> = {}
): AnnualCurrentContact => ({
  phone: '06 00 00 00 01',
  homeAddressLine: HOME_A.line,
  homeAddressComplement: 'Bâtiment B',
  homePostalCode: HOME_A.postalCode,
  homeCity: HOME_A.city,
  landAddressLine: LAND_A.line,
  landAddressComplement: 'Allée 3',
  landPostalCode: LAND_A.postalCode,
  landCity: LAND_A.city,
  companyName: null,
  ...overrides,
})

const file = (
  overrides: Partial<AnnualFileContact> = {}
): AnnualFileContact => ({
  home: HOME_A,
  land: LAND_A,
  phone: '06 00 00 00 01',
  emails: [],
  ...overrides,
})

const snapshot = (
  overrides: Partial<PennylaneImportSnapshot> = {}
): PennylaneImportSnapshot => ({
  home: HOME_A,
  land: LAND_A,
  phone: '06 00 00 00 01',
  emails: [],
  ...overrides,
})

const outcomeOf = (
  plan: ReturnType<typeof planAnnualContactUpdate>,
  group: string
) => plan.outcomes.find((outcome) => outcome.group === group)

describe('planAnnualContactUpdate — règle par groupe (ADR 077 §3)', () => {
  it('F = C : inchangé, rien à écrire', () => {
    const plan = planAnnualContactUpdate(current(), file(), snapshot(), true)

    expect(plan.changed).toBe(false)
    expect(plan.outcomes.every((o) => o.status === 'unchanged')).toBe(true)
  })

  it('C = S : la valeur du fichier est écrite', () => {
    const plan = planAnnualContactUpdate(
      current(),
      file({home: HOME_B}),
      snapshot(),
      true
    )

    expect(outcomeOf(plan, 'home')).toMatchObject({
      status: 'updated',
      reported: false,
    })
    expect(plan.changed).toBe(true)
    expect(plan.contact).toMatchObject({
      homeAddressLine: HOME_B.line,
      homePostalCode: HOME_B.postalCode,
      homeCity: HOME_B.city,
    })
  })

  it('C ≠ S et F ≠ S : la valeur du site est gardée et signalée', () => {
    const plan = planAnnualContactUpdate(
      current({homeAddressLine: HOME_C.line}),
      file({home: HOME_B}),
      snapshot(),
      false
    )

    expect(outcomeOf(plan, 'home')).toMatchObject({
      status: 'kept',
      reported: true,
    })
    expect(plan.contact.homeAddressLine).toBe(HOME_C.line)
    expect(plan.changed).toBe(false)
  })

  it('C ≠ S et F = S : gardée sans être signalée', () => {
    const plan = planAnnualContactUpdate(
      current({phone: '07 11 11 11 11'}),
      file(),
      snapshot(),
      true
    )

    expect(outcomeOf(plan, 'phone')).toMatchObject({
      status: 'kept',
      reported: false,
    })
    expect(plan.contact.phone).toBe('07 11 11 11 11')
  })

  it('sans instantané, fiche intacte depuis sa création : écrit', () => {
    const plan = planAnnualContactUpdate(
      current(),
      file({phone: '07 22 22 22 22'}),
      null,
      false
    )

    expect(outcomeOf(plan, 'phone')?.status).toBe('updated')
    expect(plan.contact.phone).toBe('07 22 22 22 22')
  })

  it('sans instantané, fiche touchée sur le site : gardée et signalée', () => {
    const plan = planAnnualContactUpdate(
      current(),
      file({phone: '07 22 22 22 22'}),
      null,
      true
    )

    expect(outcomeOf(plan, 'phone')).toMatchObject({
      status: 'kept',
      reported: true,
      current: '06 00 00 00 01',
      file: '07 22 22 22 22',
    })
    expect(plan.changed).toBe(false)
  })

  it('terrain sans livraison dans le fichier : le terrain est gardé (décision C)', () => {
    const plan = planAnnualContactUpdate(
      current(),
      file({land: undefined}),
      snapshot(),
      false
    )

    expect(outcomeOf(plan, 'land')).toMatchObject({
      status: 'unchanged',
      reported: false,
    })
    expect(plan.contact.landAddressLine).toBe(LAND_A.line)
    expect(plan.snapshot.land).toEqual(LAND_A)
  })

  it('téléphone vide dans le fichier : rien n’est effacé', () => {
    const plan = planAnnualContactUpdate(
      current(),
      file({phone: ''}),
      snapshot(),
      false
    )

    expect(plan.contact.phone).toBe('06 00 00 00 01')
    expect(plan.changed).toBe(false)
  })

  it('les compléments et l’entreprise ne sont jamais touchés', () => {
    const plan = planAnnualContactUpdate(
      current({companyName: 'SCI Les Pins'}),
      file({home: HOME_B, land: LAND_B}),
      snapshot(),
      false
    )

    expect(plan.contact).toMatchObject({
      homeAddressComplement: 'Bâtiment B',
      landAddressComplement: 'Allée 3',
      companyName: 'SCI Les Pins',
      landAddressLine: LAND_B.line,
    })
  })

  it('l’instantané reçoit la valeur du fichier, même gardée', () => {
    const plan = planAnnualContactUpdate(
      current({homeAddressLine: HOME_C.line}),
      file({home: HOME_B}),
      snapshot(),
      true
    )

    expect(plan.snapshot.home).toEqual(HOME_B)
  })

  it('rejouer le résultat : tout est inchangé', () => {
    const first = planAnnualContactUpdate(
      current(),
      file({home: HOME_B, land: LAND_B, phone: '07 33 33 33 33'}),
      snapshot(),
      false
    )
    const replay = planAnnualContactUpdate(
      first.contact,
      file({home: HOME_B, land: LAND_B, phone: '07 33 33 33 33'}),
      {...first.snapshot, emails: []},
      true
    )

    expect(replay.changed).toBe(false)
    expect(replay.outcomes.every((o) => o.status === 'unchanged')).toBe(true)
  })
})

const T0 = new Date('2026-01-10T10:00:00Z')
const T1 = new Date('2026-03-01T10:00:00Z')

let rowSeq = 0
const row = (
  email: string,
  overrides: Partial<AnnualEmailRow> = {}
): AnnualEmailRow => {
  rowSeq += 1
  return {
    id: `e-${email}`,
    email,
    role: 'additional',
    status: 'active',
    origin: 'file',
    addedByUserId: null,
    replacesEmailId: null,
    expiresAt: null,
    createdAt: new Date(T0.getTime() + rowSeq * 1000),
    updatedAt: new Date(T0.getTime() + rowSeq * 1000),
    ...overrides,
  }
}

const emailPlan = (input: Partial<AnnualEmailPlanInput>) =>
  planAnnualEmailUpdate({
    rows: [],
    cell: [],
    snapshotEmails: null,
    roleBoundEmailIds: [],
    holderRoleBound: false,
    ...input,
  })

/** Applique un plan sur des lignes, comme le service le ferait. */
const applyPlan = (
  rows: readonly AnnualEmailRow[],
  operations: AnnualEmailOperation[]
): AnnualEmailRow[] =>
  operations.reduce<AnnualEmailRow[]>(
    (acc, op) => {
      if (op.kind === 'add') {
        return [...acc, row(op.email, {role: op.role, origin: 'file'})]
      }
      return acc.map((r) => {
        if (r.id !== op.emailId) return r
        if (op.kind === 'disable') {
          return {...r, status: 'disabled_by_import', role: 'additional'}
        }
        if (op.kind === 'reactivate') {
          return {...r, status: 'active', role: op.role}
        }
        return {...r, role: 'holder'}
      })
    },
    [...rows]
  )

describe('planAnnualEmailUpdate — adresses d’une fiche (décision 2)', () => {
  it('critère 3 : la première nouvelle adresse de la cellule remplace la titulaire, l’ancienne est désactivée', () => {
    const holder = row('ancienne@exemple.test', {role: 'holder'})
    const plan = emailPlan({
      rows: [holder],
      cell: ['nouvelle@exemple.test', 'autre@exemple.test'],
      snapshotEmails: ['ancienne@exemple.test'],
    })

    expect(plan.operations).toEqual([
      {kind: 'disable', emailId: holder.id},
      {kind: 'add', email: 'nouvelle@exemple.test', role: 'holder'},
      {kind: 'add', email: 'autre@exemple.test', role: 'additional'},
    ])
    expect(plan.findings).toContainEqual({
      kind: 'replaced',
      oldEmail: 'ancienne@exemple.test',
      newEmail: 'nouvelle@exemple.test',
    })
  })

  it('critère 4 : sans adresse nouvelle, le site désigne la première active de la cellule', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const site = row('site@exemple.test', {origin: 'site'})
    const kept = row('fichier@exemple.test')
    const plan = emailPlan({
      rows: [holder, site, kept],
      cell: ['fichier@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test', 'fichier@exemple.test'],
    })

    expect(plan.operations).toEqual([
      {kind: 'disable', emailId: holder.id},
      {kind: 'promote', emailId: kept.id},
    ])
    expect(plan.findings).toContainEqual({
      kind: 'designated',
      oldEmail: 'titulaire@exemple.test',
      newEmail: 'fichier@exemple.test',
    })
  })

  it('critère 4 : hors cellule, la désignation suit created_at puis id', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const later = row('b-site@exemple.test', {origin: 'site', createdAt: T1})
    const earlierB = row('z-site@exemple.test', {
      origin: 'site',
      id: 'e-b',
      createdAt: T0,
    })
    const earlierA = row('y-site@exemple.test', {
      origin: 'site',
      id: 'e-a',
      createdAt: T0,
    })
    const plan = emailPlan({
      rows: [holder, later, earlierB, earlierA],
      cell: ['titulaire-retiree@exemple.test'],
      snapshotEmails: [
        'titulaire@exemple.test',
        'titulaire-retiree@exemple.test',
      ],
    })

    expect(plan.operations).toEqual([
      {kind: 'disable', emailId: holder.id},
      {kind: 'promote', emailId: 'e-a'},
    ])
  })

  it('critère 4 : aucune autre adresse active, la fiche passe au courrier', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const plan = emailPlan({
      rows: [holder],
      cell: ['retiree-du-site@exemple.test'],
      snapshotEmails: [
        'titulaire@exemple.test',
        'retiree-du-site@exemple.test',
      ],
    })

    expect(plan.operations).toEqual([{kind: 'disable', emailId: holder.id}])
    expect(plan.findings).toContainEqual({
      kind: 'designated',
      oldEmail: 'titulaire@exemple.test',
      newEmail: null,
    })
  })

  it('critère 5 : une supplémentaire venue du fichier précédent, absente, est désactivée', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const extra = row('extra@exemple.test')
    const plan = emailPlan({
      rows: [holder, extra],
      cell: ['titulaire@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test', 'extra@exemple.test'],
    })

    expect(plan.operations).toEqual([{kind: 'disable', emailId: extra.id}])
    expect(plan.findings).toEqual([
      {kind: 'disabled', email: 'extra@exemple.test'},
    ])
  })

  it('critère 9 : une adresse du site et une titulaire du site absentes restent actives', () => {
    const holder = row('titulaire@exemple.test', {
      role: 'holder',
      origin: 'site',
    })
    const site = row('site@exemple.test', {origin: 'site'})
    const plan = emailPlan({
      rows: [holder, site],
      cell: ['nouvelle@exemple.test'],
      snapshotEmails: [],
    })

    expect(plan.operations).toEqual([
      {kind: 'add', email: 'nouvelle@exemple.test', role: 'additional'},
    ])
    expect(plan.findings).toContainEqual({
      kind: 'kept',
      current: ['titulaire@exemple.test', 'site@exemple.test'],
      file: ['nouvelle@exemple.test'],
    })
  })

  it('une adresse du fichier modifiée sur le site (hors S.emails) est gardée', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const corrected = row('corrigee@exemple.test')
    const plan = emailPlan({
      rows: [holder, corrected],
      cell: ['titulaire@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test', 'avant@exemple.test'],
    })

    expect(plan.operations).toEqual([])
  })

  it('sans instantané, une adresse du fichier jamais modifiée est désactivée, une modifiée gardée', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const intact = row('intacte@exemple.test')
    const touched = row('touchee@exemple.test', {updatedAt: T1})
    const plan = emailPlan({
      rows: [holder, intact, touched],
      cell: ['titulaire@exemple.test'],
      snapshotEmails: null,
    })

    expect(plan.operations).toEqual([{kind: 'disable', emailId: intact.id}])
  })

  it('une adresse retirée sur le site n’est pas rajoutée', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const plan = emailPlan({
      rows: [holder],
      cell: ['titulaire@exemple.test', 'retiree@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test'],
    })
    const removed = emailPlan({
      rows: [holder],
      cell: ['titulaire@exemple.test', 'retiree@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test', 'retiree@exemple.test'],
    })

    expect(plan.operations).toEqual([
      {kind: 'add', email: 'retiree@exemple.test', role: 'additional'},
    ])
    expect(removed.operations).toEqual([])
  })

  it('décision D : une adresse désactivée qui réapparaît est réactivée en supplémentaire', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const disabled = row('revenue@exemple.test', {status: 'disabled_by_import'})
    const plan = emailPlan({
      rows: [holder, disabled],
      cell: ['titulaire@exemple.test', 'revenue@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test'],
    })

    expect(plan.operations).toEqual([
      {kind: 'reactivate', emailId: disabled.id, role: 'additional'},
    ])
  })

  it('fiche sans adresse active : la première adresse nouvelle devient titulaire, sans désignation', () => {
    const plan = emailPlan({
      rows: [],
      cell: ['premiere@exemple.test', 'seconde@exemple.test'],
      snapshotEmails: [],
    })

    expect(plan.operations).toEqual([
      {kind: 'add', email: 'premiere@exemple.test', role: 'holder'},
      {kind: 'add', email: 'seconde@exemple.test', role: 'additional'},
    ])
    expect(plan.findings).toEqual([])
  })

  it('décision B : titulaire à rôle, aucune opération, constat « à corriger à la main »', () => {
    const holder = row('presidente@exemple.test', {role: 'holder'})
    const plan = emailPlan({
      rows: [holder],
      cell: ['nouvelle@exemple.test'],
      snapshotEmails: ['presidente@exemple.test'],
      roleBoundEmailIds: [holder.id],
      holderRoleBound: true,
    })

    expect(plan.operations).toEqual([])
    expect(plan.findings).toEqual([
      {
        kind: 'manual',
        holderEmail: 'presidente@exemple.test',
        file: ['nouvelle@exemple.test'],
      },
    ])
    expect(plan.snapshotEmails).toEqual(['presidente@exemple.test'])
  })

  it('une supplémentaire dont le compte porte un rôle n’est jamais désactivée', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const board = row('bureau@exemple.test')
    const plan = emailPlan({
      rows: [holder, board],
      cell: ['titulaire@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test', 'bureau@exemple.test'],
      roleBoundEmailIds: [board.id],
    })

    expect(plan.operations).toEqual([])
    expect(plan.findings).toEqual([
      {
        kind: 'manual',
        holderEmail: 'titulaire@exemple.test',
        file: ['titulaire@exemple.test'],
      },
    ])
  })

  it('une adresse en attente n’est jamais touchée', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const pending = row('attente@exemple.test', {status: 'pending'})
    const plan = emailPlan({
      rows: [holder, pending],
      cell: ['titulaire@exemple.test', 'attente@exemple.test'],
      snapshotEmails: ['titulaire@exemple.test', 'attente@exemple.test'],
    })

    expect(plan.operations).toEqual([])
  })

  it('une cellule vide n’efface rien', () => {
    const holder = row('titulaire@exemple.test', {role: 'holder'})
    const plan = emailPlan({
      rows: [holder],
      cell: [],
      snapshotEmails: ['titulaire@exemple.test'],
    })

    expect(plan.operations).toEqual([])
    expect(plan.snapshotEmails).toEqual(['titulaire@exemple.test'])
  })

  it('l’instantané reçoit la cellule en minuscules, dans son ordre', () => {
    const plan = emailPlan({
      rows: [],
      cell: ['Premiere@Exemple.test', 'seconde@exemple.test'],
      snapshotEmails: null,
    })

    expect(plan.snapshotEmails).toEqual([
      'premiere@exemple.test',
      'seconde@exemple.test',
    ])
  })

  it.each([
    ['remplacement', ['nouvelle@exemple.test', 'autre@exemple.test']],
    ['désignation', ['fichier@exemple.test']],
    ['désactivation', ['titulaire@exemple.test']],
    ['réactivation', ['titulaire@exemple.test', 'revenue@exemple.test']],
  ])(
    'rejouer le plan appliqué (%s) : aucune opération, aucun constat',
    (_, cell) => {
      const rows = [
        row('titulaire@exemple.test', {role: 'holder'}),
        row('fichier@exemple.test'),
        row('extra@exemple.test'),
        row('site@exemple.test', {origin: 'site'}),
        row('revenue@exemple.test', {status: 'disabled_by_import'}),
      ]
      const snapshotEmails = [
        'titulaire@exemple.test',
        'fichier@exemple.test',
        'extra@exemple.test',
      ]
      const first = emailPlan({rows, cell, snapshotEmails})
      const replay = emailPlan({
        rows: applyPlan(rows, first.operations),
        cell,
        snapshotEmails: first.snapshotEmails,
      })

      expect(first.operations.length).toBeGreaterThan(0)
      expect(replay.operations).toEqual([])
      expect(replay.findings).toEqual([])
    }
  )
})

describe('planEmailRemoval — adresse désactivée (ADR 076 §5)', () => {
  it('une adresse désactivée se retire sans remplaçante', () => {
    const disabled = row('desactivee@exemple.test', {
      status: 'disabled_by_import',
    })
    const holder = row('titulaire@exemple.test', {role: 'holder'})

    expect(
      planEmailRemoval([holder, disabled], disabled.id, {kind: 'none'})
    ).toEqual({ok: true, removeEmailId: disabled.id})
  })
})
