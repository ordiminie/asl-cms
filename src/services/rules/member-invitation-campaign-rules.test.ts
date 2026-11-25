import {describe, expect, it} from 'vitest'

import type {CampaignTargetRow} from './campaign-rules'
import {computeCampaignTarget} from './campaign-rules'
import {
  type InvitationAddressRow,
  invitationOverviewOf,
  invitationSkipOf,
  invitationStatesOf,
  launchCountsOf,
  launchPredicate,
  reminderCountsOf,
  reminderPredicateOf,
} from './member-invitation-campaign-rules'

const NOW = new Date('2026-11-24T10:00:00.000Z')
const CREATED = new Date('2026-11-24T08:00:00.000Z')
const BEFORE = new Date('2026-11-20T08:00:00.000Z')
const AFTER = new Date('2026-11-25T08:00:00.000Z')

const row = (
  memberProfileId: string,
  email: string | null,
  overrides: Partial<CampaignTargetRow> = {}
): CampaignTargetRow => ({
  memberProfileId,
  name: `Fiche ${memberProfileId}`,
  email,
  unsubscribed: false,
  currentParcelNumbers: [memberProfileId.toUpperCase()],
  accountName: null,
  ...overrides,
})

const address = (
  memberProfileId: string,
  email: string,
  overrides: Partial<InvitationAddressRow> = {}
): InvitationAddressRow => ({
  email,
  status: 'active',
  createdAt: BEFORE,
  expiresAt: null,
  memberProfileId,
  name: `Fiche ${memberProfileId}`,
  parcelNumbers: [memberProfileId.toUpperCase()],
  ...overrides,
})

const state = (
  email: string,
  overrides: {lastInvitedAt?: Date | null; firstSignedInAt?: Date | null} = {}
) => ({
  email,
  userId: `user-${email}`,
  lastInvitedAt: null,
  firstSignedInAt: null,
  ...overrides,
})

describe('cible du lancement (critères 1, 5, 6)', () => {
  it('fiche à deux adresses actives (s54) : deux destinataires, une fiche', () => {
    const rows = [row('a', 'anne@x.fr'), row('a', 'proche@x.fr')]

    const target = computeCampaignTarget(rows, launchPredicate, 'statutaire')
    expect(target.recipients.map((r) => r.email)).toEqual([
      'anne@x.fr',
      'proche@x.fr',
    ])
    expect(
      launchCountsOf({rows, nature: 'statutaire', addresses: [], now: NOW})
    ).toMatchObject({profilesWithEmail: 1, recipients: 2, profiles: 1})
  })

  it('adresse sur deux fiches (s53) : un destinataire, deux fiches couvertes', () => {
    const rows = [row('a', 'Anne@x.fr'), row('b', 'anne@x.fr ')]

    expect(
      launchCountsOf({rows, nature: 'statutaire', addresses: [], now: NOW})
    ).toMatchObject({profilesWithEmail: 2, recipients: 1, profilesByLetter: 0})
  })

  it('fiche aux seules adresses en attente : elle reçoit le courrier, l’attente est comptée à part', () => {
    const rows = [row('a', 'anne@x.fr'), row('b', null)]
    const addresses = [
      address('a', 'anne@x.fr'),
      address('b', 'attente@x.fr', {
        status: 'pending',
        expiresAt: AFTER,
      }),
      address('b', 'echue@x.fr', {status: 'pending', expiresAt: BEFORE}),
    ]

    expect(
      launchCountsOf({rows, nature: 'statutaire', addresses, now: NOW})
    ).toEqual({
      nature: 'statutaire',
      profilesWithEmail: 1,
      profilesByLetter: 1,
      profilesRefused: 0,
      profiles: 2,
      recipients: 1,
      unsubscribed: 0,
      pendingAddresses: 1,
    })
  })

  it('fiche toute désinscrite : email en statutaire, rien en facultative, comptée « refus » (Q3)', () => {
    const rows = [
      row('a', 'anne@x.fr', {unsubscribed: true}),
      row('b', 'paul@x.fr'),
      row('c', null),
    ]

    const statutory = launchCountsOf({
      rows,
      nature: 'statutaire',
      addresses: [],
      now: NOW,
    })
    expect(statutory).toMatchObject({
      profilesWithEmail: 2,
      profilesByLetter: 1,
      profilesRefused: 0,
      recipients: 2,
      unsubscribed: 1,
    })
    expect(
      statutory.profilesWithEmail +
        statutory.profilesByLetter +
        statutory.profilesRefused
    ).toBe(statutory.profiles)

    expect(
      launchCountsOf({rows, nature: 'facultative', addresses: [], now: NOW})
    ).toMatchObject({
      profilesWithEmail: 1,
      profilesByLetter: 1,
      profilesRefused: 1,
      profiles: 3,
      recipients: 1,
      unsubscribed: 1,
    })
  })

  it('C5 sous la nature du seed : aucune fiche à zéro canal, sur un échantillon mêlé', () => {
    const rows = [
      row('a', 'anne@x.fr', {unsubscribed: true}),
      row('a', 'proche@x.fr', {unsubscribed: true}),
      row('b', 'anne@x.fr'),
      row('c', null),
      row('d', 'dom@x.fr'),
    ]
    const counts = launchCountsOf({
      rows,
      nature: 'statutaire',
      addresses: [],
      now: NOW,
    })
    expect(counts.profilesRefused).toBe(0)
    expect(counts.profilesWithEmail + counts.profilesByLetter).toBe(4)
  })
})

describe('cible de la relance (critère 8)', () => {
  const states = invitationStatesOf([
    state('titulaire@x.fr', {lastInvitedAt: BEFORE, firstSignedInAt: BEFORE}),
    state('proche@x.fr', {lastInvitedAt: BEFORE}),
  ])
  const rows = [
    row('a', 'titulaire@x.fr'),
    row('a', 'proche@x.fr'),
    row('b', 'nouvelle@x.fr'),
    row('c', null),
  ]

  it('le proche d’un titulaire connecté et l’adresse ajoutée après le lancement sont relancés ; l’adresse connectée et la fiche sans email ne le sont pas', () => {
    const target = computeCampaignTarget(
      rows,
      reminderPredicateOf(states),
      'statutaire'
    )

    expect(target.recipients.map((r) => r.email)).toEqual([
      'proche@x.fr',
      'nouvelle@x.fr',
    ])
    expect(target.withoutEmailProfileIds).toEqual([])
  })

  it('une adresse sans compte compte comme jamais connectée', () => {
    expect(
      reminderPredicateOf(invitationStatesOf([]))({
        memberProfileId: 'a',
        email: 'Inconnue@x.fr',
      })
    ).toBe(true)
    expect(
      reminderPredicateOf(states)({memberProfileId: 'c', email: null})
    ).toBe(false)
  })

  it('décompte 1f : destinataires, jamais invitées, désinscrites, en attente (jamais relancées)', () => {
    const addresses = [
      address('a', 'titulaire@x.fr'),
      address('a', 'proche@x.fr'),
      address('b', 'nouvelle@x.fr'),
      address('c', 'attente@x.fr', {status: 'pending', expiresAt: AFTER}),
    ]

    expect(
      reminderCountsOf({
        rows: [...rows, row('d', 'refus@x.fr', {unsubscribed: true})],
        states,
        nature: 'facultative',
        addresses,
        now: NOW,
      })
    ).toEqual({
      nature: 'facultative',
      recipients: 2,
      neverInvited: 1,
      unsubscribed: 1,
      pendingAddresses: 1,
    })
  })
})

describe('invitationSkipOf — écart à l’envoi (ADR 072 §5)', () => {
  it('connectée depuis : superseded', () => {
    expect(
      invitationSkipOf(state('a@x.fr', {firstSignedInAt: AFTER}), CREATED)
    ).toBe('superseded')
  })

  it('réinvitée après la création de la campagne : superseded', () => {
    expect(
      invitationSkipOf(state('a@x.fr', {lastInvitedAt: AFTER}), CREATED)
    ).toBe('superseded')
  })

  it('invitée avant la création, jamais connectée, ou sans compte : rien n’est écarté', () => {
    expect(
      invitationSkipOf(state('a@x.fr', {lastInvitedAt: BEFORE}), CREATED)
    ).toBeNull()
    expect(
      invitationSkipOf(state('a@x.fr', {lastInvitedAt: CREATED}), CREATED)
    ).toBeNull()
    expect(invitationSkipOf(undefined, CREATED)).toBeNull()
  })
})

describe('invitationOverviewOf — suivi par adresse (critère 7)', () => {
  const addresses = [
    address('b', 'Partagee@x.fr', {name: 'Bernard'}),
    address('a', 'partagee@x.fr', {name: 'Aubry'}),
    address('a', 'connectee@x.fr', {name: 'Aubry'}),
    address('c', 'nouvelle@x.fr', {name: 'Caron', createdAt: AFTER}),
    address('d', 'attente@x.fr', {
      name: 'Dupuis',
      status: 'pending',
      expiresAt: AFTER,
    }),
    address('e', 'echue@x.fr', {
      name: 'Escoffier',
      status: 'pending',
      expiresAt: BEFORE,
    }),
  ]
  const states = invitationStatesOf([
    state('partagee@x.fr', {lastInvitedAt: CREATED}),
    state('connectee@x.fr', {lastInvitedAt: CREATED, firstSignedInAt: AFTER}),
  ])
  const rows = [
    row('a', 'partagee@x.fr'),
    row('a', 'connectee@x.fr'),
    row('b', 'partagee@x.fr'),
    row('c', 'nouvelle@x.fr'),
    row('d', null),
    row('e', null),
  ]

  const overview = (page = 1, list = addresses) =>
    invitationOverviewOf({
      addresses: list,
      states,
      rows,
      nature: 'statutaire',
      now: NOW,
      page,
    })

  it('compte en adresses : invitées, connectées, jamais connectées (actives), en attente ; l’attente échue est masquée', () => {
    expect(overview()).toMatchObject({
      invited: 2,
      signedIn: 1,
      neverSignedIn: 2,
      pending: 1,
    })
  })

  it('une ligne par adresse, ses fiches empilées, un seul état ; triée par nom de fiche ; l’attente marquée', () => {
    const {addresses: list} = overview()

    expect(list.total).toBe(3)
    expect(list.pendingCount).toBe(1)
    expect(list.items).toEqual([
      {
        email: 'partagee@x.fr',
        profiles: [
          {id: 'a', name: 'Aubry', parcelNumbers: ['A']},
          {id: 'b', name: 'Bernard', parcelNumbers: ['B']},
        ],
        pending: false,
        lastInvitedAt: CREATED.toISOString(),
        addedAt: BEFORE.toISOString(),
      },
      {
        email: 'nouvelle@x.fr',
        profiles: [{id: 'c', name: 'Caron', parcelNumbers: ['C']}],
        pending: false,
        lastInvitedAt: null,
        addedAt: AFTER.toISOString(),
      },
      {
        email: 'attente@x.fr',
        profiles: [{id: 'd', name: 'Dupuis', parcelNumbers: ['D']}],
        pending: true,
        lastInvitedAt: null,
        addedAt: BEFORE.toISOString(),
      },
    ])
  })

  it('pagine par 25 et borne la page demandée', () => {
    const many = Array.from({length: 30}, (_, index) =>
      address(`p${String(index).padStart(2, '0')}`, `m${index}@x.fr`, {
        name: `Membre ${String(index).padStart(2, '0')}`,
      })
    )

    const second = overview(2, many).addresses
    expect(second).toMatchObject({page: 2, pageSize: 25, total: 30})
    expect(second.totalPages).toBe(2)
    expect(second.items).toHaveLength(5)
    expect(overview(9, many).addresses.page).toBe(2)
  })

  it('couverture en fiches sous la nature du lancement ; en facultative, les fiches qui ont tout refusé sont listées', () => {
    expect(overview().coverage).toEqual({byEmail: 3, byLetter: 2, neither: 0})
    expect(overview().refusedProfiles).toEqual([])

    const refused = invitationOverviewOf({
      addresses,
      states,
      rows: [...rows, row('f', 'refus@x.fr', {unsubscribed: true})],
      nature: 'facultative',
      now: NOW,
      page: 1,
    })
    expect(refused.coverage).toEqual({byEmail: 3, byLetter: 2, neither: 1})
    expect(refused.refusedProfiles).toEqual([
      {id: 'f', name: 'Fiche f', parcelNumbers: ['F']},
    ])
  })
})
