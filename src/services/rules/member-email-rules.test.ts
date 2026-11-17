import {describe, expect, it} from 'vitest'

import {MemberEmailRecord} from '../types/domain/member-email-types'
import {
  canMemberManagePending,
  canMemberReplaceEmail,
  confirmationExpiryOf,
  decideConfirmation,
  decideMemberEmailAddition,
  importedEmailsPlan,
  isPendingExpired,
  ownEmailOf,
  pendingRowsStillAuthored,
  planEmailRemoval,
  planHolderDesignation,
  planReplacementConfirmation,
  roleForNewActiveEmail,
  visibleEmails,
} from './member-email-rules'

const NOW = new Date('2026-11-16T10:00:00Z')
const LATER = new Date('2026-11-23T10:00:00Z')
const EARLIER = new Date('2026-11-10T10:00:00Z')

const record = (
  overrides: Partial<MemberEmailRecord> & {id: string; email: string}
): MemberEmailRecord => ({
  role: 'additional',
  status: 'active',
  addedByUserId: null,
  replacesEmailId: null,
  expiresAt: null,
  ...overrides,
})

const jean = record({id: 'e1', email: 'jean@exemple.fr', role: 'holder'})
const claire = record({id: 'e2', email: 'claire@exemple.fr'})
const marcPending = record({
  id: 'e3',
  email: 'marc@exemple.fr',
  status: 'pending',
  addedByUserId: 'user-claire',
  expiresAt: LATER,
})

describe('succession de la titulaire (critère 9)', () => {
  it('fiche sans adresse active qui en reçoit une : elle devient titulaire', () => {
    expect(roleForNewActiveEmail([], undefined)).toEqual({
      role: 'holder',
      demoteEmailId: null,
    })
    expect(roleForNewActiveEmail([marcPending], 'additional')).toEqual({
      role: 'holder',
      demoteEmailId: null,
    })
  })

  it('fiche à titulaire : l’ajout est supplémentaire par défaut, aucune promotion d’office', () => {
    expect(roleForNewActiveEmail([jean, claire], undefined)).toEqual({
      role: 'additional',
      demoteEmailId: null,
    })
  })

  it('ajout comme titulaire choisi par le bureau : l’ancienne titulaire devient supplémentaire', () => {
    expect(roleForNewActiveEmail([jean, claire], 'holder')).toEqual({
      role: 'holder',
      demoteEmailId: 'e1',
    })
  })

  it('désigne une supplémentaire active : elle prend le titre, l’ancienne devient supplémentaire', () => {
    expect(planHolderDesignation([jean, claire], 'e2')).toEqual({
      ok: true,
      promoteEmailId: 'e2',
      demoteEmailId: 'e1',
    })
  })

  it('refuse de désigner une adresse en attente, déjà titulaire ou absente', () => {
    expect(planHolderDesignation([jean, marcPending], 'e3')).toEqual({
      ok: false,
      reason: 'not_active',
    })
    expect(planHolderDesignation([jean], 'e1')).toEqual({
      ok: false,
      reason: 'already_holder',
    })
    expect(planHolderDesignation([jean], 'absent')).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })

  it('retire la titulaire en désignant une adresse active existante', () => {
    expect(
      planEmailRemoval([jean, claire], 'e1', {kind: 'existing', emailId: 'e2'})
    ).toEqual({ok: true, removeEmailId: 'e1', promoteEmailId: 'e2'})
  })

  it('retire la titulaire en saisissant une nouvelle adresse, qui devient titulaire', () => {
    expect(
      planEmailRemoval([jean, claire], 'e1', {
        kind: 'new',
        email: 'odile@exemple.fr',
      })
    ).toEqual({
      ok: true,
      removeEmailId: 'e1',
      addHolderEmail: 'odile@exemple.fr',
    })
  })

  it('refuse de retirer la titulaire sans remplaçante quand une autre adresse est active', () => {
    expect(planEmailRemoval([jean, claire], 'e1', {kind: 'none'})).toEqual({
      ok: false,
      reason: 'replacement_required',
    })
  })

  it('retire la dernière adresse active sans remplaçante : la fiche passe en courrier', () => {
    expect(planEmailRemoval([jean, marcPending], 'e1', {kind: 'none'})).toEqual(
      {ok: true, removeEmailId: 'e1', mailOnly: true}
    )
  })

  it('refuse une remplaçante en attente, absente, ou la titulaire elle-même', () => {
    for (const emailId of ['e3', 'absent', 'e1']) {
      expect(
        planEmailRemoval([jean, claire, marcPending], 'e1', {
          kind: 'existing',
          emailId,
        })
      ).toEqual({ok: false, reason: 'invalid_replacement'})
    }
  })

  it('refuse une nouvelle remplaçante déjà présente sur la fiche', () => {
    expect(
      planEmailRemoval([jean, claire], 'e1', {
        kind: 'new',
        email: 'CLAIRE@exemple.fr',
      })
    ).toEqual({ok: false, reason: 'already_listed'})
  })

  it('retire une supplémentaire sans toucher au titre', () => {
    expect(planEmailRemoval([jean, claire], 'e2', {kind: 'none'})).toEqual({
      ok: true,
      removeEmailId: 'e2',
    })
  })

  it('modification confirmée de la titulaire : le titre est transmis', () => {
    const replacing = record({
      id: 'e4',
      email: 'jean.nouveau@exemple.fr',
      status: 'pending',
      replacesEmailId: 'e1',
      addedByUserId: 'user-jean',
      expiresAt: LATER,
    })

    expect(
      planReplacementConfirmation([jean, claire, replacing], 'e4')
    ).toEqual({role: 'holder', removeEmailId: 'e1', demoteEmailId: null})
  })

  it('modification confirmée d’une supplémentaire : elle reste supplémentaire', () => {
    const replacing = record({
      id: 'e4',
      email: 'claire.nouveau@exemple.fr',
      status: 'pending',
      replacesEmailId: 'e2',
      expiresAt: LATER,
    })

    expect(
      planReplacementConfirmation([jean, claire, replacing], 'e4')
    ).toEqual({role: 'additional', removeEmailId: 'e2', demoteEmailId: null})
  })

  it('ajout confirmé sur une fiche à titulaire : supplémentaire, rien n’est retiré', () => {
    expect(
      planReplacementConfirmation([jean, claire, marcPending], 'e3')
    ).toEqual({role: 'additional', removeEmailId: null, demoteEmailId: null})
  })

  it('ajout confirmé sur une fiche sans adresse active : titulaire', () => {
    expect(planReplacementConfirmation([marcPending], 'e3')).toEqual({
      role: 'holder',
      removeEmailId: null,
      demoteEmailId: null,
    })
  })

  it('création par import : la première adresse de la cellule est titulaire, les suivantes supplémentaires', () => {
    expect(
      importedEmailsPlan([], ['a@exemple.fr', 'b@exemple.fr', 'c@exemple.fr'])
    ).toEqual([
      {email: 'a@exemple.fr', role: 'holder'},
      {email: 'b@exemple.fr', role: 'additional'},
      {email: 'c@exemple.fr', role: 'additional'},
    ])
  })

  it('fiche existante : l’ordre de la cellule ne déplace pas le titre, seules les nouvelles adresses s’ajoutent', () => {
    expect(
      importedEmailsPlan(
        [jean, claire],
        ['claire@exemple.fr', 'JEAN@exemple.fr', 'nouvelle@exemple.fr']
      )
    ).toEqual([{email: 'nouvelle@exemple.fr', role: 'additional'}])
  })

  it('fiche existante sans adresse active : la première nouvelle adresse devient titulaire', () => {
    expect(
      importedEmailsPlan([marcPending], ['x@exemple.fr', 'y@exemple.fr'])
    ).toEqual([
      {email: 'x@exemple.fr', role: 'holder'},
      {email: 'y@exemple.fr', role: 'additional'},
    ])
  })
})

describe('droits du membre sur les adresses (critère 4)', () => {
  it('sa propre adresse est l’adresse active égale à celle de la session', () => {
    expect(ownEmailOf([jean, claire], 'Claire@Exemple.fr')).toEqual(claire)
    expect(ownEmailOf([jean, marcPending], 'marc@exemple.fr')).toBeUndefined()
  })

  it('une supplémentaire ne modifie pas la titulaire', () => {
    expect(canMemberReplaceEmail(jean, 'claire@exemple.fr')).toBe(false)
  })

  it('la titulaire ne modifie pas une supplémentaire', () => {
    expect(canMemberReplaceEmail(claire, 'jean@exemple.fr')).toBe(false)
  })

  it('chacune modifie la sienne, active', () => {
    expect(canMemberReplaceEmail(jean, 'jean@exemple.fr')).toBe(true)
    expect(canMemberReplaceEmail(claire, 'claire@exemple.fr')).toBe(true)
    expect(
      canMemberReplaceEmail(
        record({id: 'p', email: 'jean@exemple.fr', status: 'pending'}),
        'jean@exemple.fr'
      )
    ).toBe(false)
  })

  it('corrige ou annule seulement une attente dont elle est l’autrice, non échue', () => {
    expect(canMemberManagePending(marcPending, 'user-claire', NOW)).toBe(true)
    expect(canMemberManagePending(marcPending, 'user-jean', NOW)).toBe(false)
    expect(canMemberManagePending(claire, 'user-claire', NOW)).toBe(false)
    expect(
      canMemberManagePending(
        {...marcPending, expiresAt: EARLIER},
        'user-claire',
        NOW
      )
    ).toBe(false)
  })

  it('refuse une adresse portée par une fiche de l’association non reliée au compte (critère 7)', () => {
    expect(
      decideMemberEmailAddition({
        email: 'voisin@exemple.fr',
        myEmails: [jean, claire],
        carrierProfileIds: ['fiche-voisin'],
        myProfileIds: ['fiche-jean'],
        now: NOW,
      })
    ).toBe('taken')
  })

  it('refuse une adresse déjà dans la liste, sans casse', () => {
    expect(
      decideMemberEmailAddition({
        email: 'CLAIRE@exemple.fr',
        myEmails: [jean, claire],
        carrierProfileIds: ['fiche-jean'],
        myProfileIds: ['fiche-jean'],
        now: NOW,
      })
    ).toBe('already_listed')
  })

  it('accepte une adresse inconnue, ou portée seulement par ses propres fiches', () => {
    expect(
      decideMemberEmailAddition({
        email: 'nouvelle@exemple.fr',
        myEmails: [jean],
        carrierProfileIds: [],
        myProfileIds: ['fiche-jean'],
        now: NOW,
      })
    ).toBe('ok')
    expect(
      decideMemberEmailAddition({
        email: 'claire@exemple.fr',
        myEmails: [jean],
        carrierProfileIds: ['fiche-lot-2'],
        myProfileIds: ['fiche-jean', 'fiche-lot-2'],
        now: NOW,
      })
    ).toBe('ok')
  })

  it('une attente échue ne compte plus comme déjà listée', () => {
    expect(
      decideMemberEmailAddition({
        email: 'marc@exemple.fr',
        myEmails: [jean, {...marcPending, expiresAt: EARLIER}],
        carrierProfileIds: [],
        myProfileIds: ['fiche-jean'],
        now: NOW,
      })
    ).toBe('ok')
  })
})

describe('expiration et confirmation (critère 5)', () => {
  it('l’échéance est le délai du tenant en jours après maintenant', () => {
    expect(confirmationExpiryOf(NOW, 7)).toEqual(LATER)
  })

  it('une attente échue est ignorée à la lecture, une active jamais', () => {
    expect(isPendingExpired({...marcPending, expiresAt: EARLIER}, NOW)).toBe(
      true
    )
    expect(isPendingExpired(marcPending, NOW)).toBe(false)
    expect(isPendingExpired(jean, NOW)).toBe(false)
    expect(
      visibleEmails([jean, {...marcPending, expiresAt: EARLIER}], NOW)
    ).toEqual([jean])
  })

  it('jeton inconnu, échu ou déjà utilisé : un seul état « lien inutilisable »', () => {
    expect(
      decideConfirmation({record: undefined, takenElsewhere: false, now: NOW})
    ).toBe('invalid')
    expect(
      decideConfirmation({
        record: {...marcPending, expiresAt: EARLIER},
        takenElsewhere: false,
        now: NOW,
      })
    ).toBe('invalid')
    expect(
      decideConfirmation({record: claire, takenElsewhere: false, now: NOW})
    ).toBe('invalid')
  })

  it('adresse prise entre-temps par une autre fiche : rien n’est activé', () => {
    expect(
      decideConfirmation({record: marcPending, takenElsewhere: true, now: NOW})
    ).toBe('taken')
  })

  it('attente valide : elle se confirme', () => {
    expect(
      decideConfirmation({record: marcPending, takenElsewhere: false, now: NOW})
    ).toBe('ok')
  })
})

describe('l’auteur d’une attente n’est plus relié à la fiche (revue C1)', () => {
  const row = (memberProfileId: string, addedByUserId: string | null) => ({
    id: `pending-${memberProfileId}`,
    memberProfileId,
    addedByUserId,
  })

  it('garde les attentes des fiches encore reliées à l’auteur, jamais celles sans auteur (revue mi4)', () => {
    expect(
      pendingRowsStillAuthored(
        [row('p1', 'user-claire'), row('p2', 'user-claire'), row('p3', null)],
        new Map([['user-claire', new Set(['p2', 'p3'])]])
      ).map((kept) => kept.memberProfileId)
    ).toEqual(['p2'])
  })

  it('aucune fiche encore reliée : rien ne reste', () => {
    expect(
      pendingRowsStillAuthored(
        [row('p1', 'user-claire')],
        new Map([['user-claire', new Set<string>()]])
      )
    ).toEqual([])
  })

  it('chaque attente est jugée sur son propre auteur', () => {
    expect(
      pendingRowsStillAuthored(
        [row('p1', 'user-claire-b'), row('p2', 'user-claire')],
        new Map([
          ['user-claire-b', new Set(['p1'])],
          ['user-claire', new Set(['p2'])],
        ])
      ).map((kept) => kept.memberProfileId)
    ).toEqual(['p1', 'p2'])
  })

  it('attente valide mais plus rien d’autorisé : le même « invalid » (3c), avant « taken » (revue MA1)', () => {
    expect(
      decideConfirmation({
        record: marcPending,
        takenElsewhere: true,
        revoked: true,
        now: NOW,
      })
    ).toBe('invalid')
  })

  it('un lien inutilisable reste « invalid », même révoqué', () => {
    expect(
      decideConfirmation({
        record: undefined,
        takenElsewhere: false,
        revoked: true,
        now: NOW,
      })
    ).toBe('invalid')
  })
})
