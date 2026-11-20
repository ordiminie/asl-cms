import {describe, expect, it} from 'vitest'

import {CampaignNature} from '../types/domain/campaign-types'
import {
  campaignChannelsOf,
  homonymGroupsOf,
  letterAddressLinesOf,
  LetterProfile,
  lettersOf,
  sameNameAndHomeKeyOf,
} from './campaign-letter-rules'
import {computeCampaignTarget} from './campaign-rules'

const row = (
  memberProfileId: string,
  email: string | null,
  unsubscribed = false
) => ({
  memberProfileId,
  name: `Fiche ${memberProfileId}`,
  email,
  unsubscribed,
  currentParcelNumbers: [],
  accountName: null,
})

const only =
  (...ids: string[]) =>
  (candidate: {memberProfileId: string}) =>
    ids.includes(candidate.memberProfileId)

/**
 * Critere 6 de s28, ecrit en premier : email ∪ courrier ∪ refus = toutes les
 * fiches ciblees, sans intersection. Un refus (adresse desinscrite d'un envoi
 * facultatif) n'est jamais un courrier (ADR 065 §3).
 */
describe('campaignChannelsOf — complétude des canaux (critère 6)', () => {
  const rows = [
    row('a', 'a@x.fr'),
    row('b', 'b@x.fr', true),
    row('c', null),
    row('d', 'shared@x.fr'),
    row('e', 'shared@x.fr', true),
    row('f', 'f1@x.fr', true),
    row('f', 'f2@x.fr'),
    row('g', null),
    row('h', 'h@x.fr'),
  ]
  const predicates = {
    tous: () => true,
    impayés: only('a', 'b', 'c', 'e', 'f'),
    groupe: only('b', 'd', 'g'),
  }
  const targetedIdsOf = (
    isTargeted: (r: {memberProfileId: string}) => boolean
  ) => new Set(rows.filter(isTargeted).map((r) => r.memberProfileId))

  const cases = Object.entries(predicates).flatMap(([label, isTargeted]) =>
    (['facultative', 'statutaire'] as CampaignNature[]).map(
      (nature) => [label, nature, isTargeted] as const
    )
  )

  it.each(cases)(
    'cible « %s », envoi %s : l’union fait toutes les fiches ciblées, sans intersection',
    (_, nature, isTargeted) => {
      const channels = campaignChannelsOf(rows, isTargeted, nature)
      const all = [
        ...channels.emailProfileIds,
        ...channels.letterProfileIds,
        ...channels.refusedProfileIds,
      ]

      expect(new Set(all)).toEqual(targetedIdsOf(isTargeted))
      expect(all).toHaveLength(new Set(all).size)
    }
  )

  it('une fiche sans adresse active ciblée est au courrier, jamais à l’email', () => {
    const channels = campaignChannelsOf(rows, () => true, 'facultative')

    expect(channels.letterProfileIds).toEqual(['c', 'g'])
    expect(channels.emailProfileIds).not.toContain('c')
  })

  it('toutes ses adresses désinscrites d’un envoi facultatif : refus, pas courrier', () => {
    const channels = campaignChannelsOf(rows, () => true, 'facultative')

    expect(channels.refusedProfileIds).toEqual(
      expect.arrayContaining(['b', 'd', 'e'])
    )
    expect(channels.letterProfileIds).not.toContain('b')
  })

  it('une adresse encore servie suffit : la fiche reste à l’email', () => {
    const channels = campaignChannelsOf(rows, () => true, 'facultative')

    expect(channels.emailProfileIds).toContain('f')
  })

  it('en statutaire, les désinscrits sont réintégrés : aucun refus', () => {
    const channels = campaignChannelsOf(rows, () => true, 'statutaire')

    expect(channels.refusedProfileIds).toEqual([])
    expect(channels.emailProfileIds).toEqual(
      expect.arrayContaining(['a', 'b', 'd', 'e', 'f', 'h'])
    )
  })

  it('une fiche hors cible n’est dans aucun canal', () => {
    const channels = campaignChannelsOf(rows, only('a'), 'facultative')

    expect(channels).toEqual({
      emailProfileIds: ['a'],
      letterProfileIds: [],
      refusedProfileIds: [],
    })
  })
})

describe('computeCampaignTarget — ids des fiches sans email (s28)', () => {
  it('expose les fiches ciblées sans adresse active ; le décompte en dérive', () => {
    const target = computeCampaignTarget(
      [row('a', 'a@x.fr'), row('c', null), row('g', null), row('z', null)],
      only('a', 'c', 'g')
    )

    expect(target.withoutEmailProfileIds).toEqual(['c', 'g'])
    expect(target.withoutEmail).toBe(2)
  })
})

const profile = (overrides: Partial<LetterProfile> = {}): LetterProfile => ({
  id: 'p1',
  name: 'Marcel Laurent',
  companyName: null,
  homeAddressLine: '4 rue des Lilas',
  homeAddressComplement: null,
  homePostalCode: '69003',
  homeCity: 'Lyon',
  landAddressLine: '12 chemin de la Fourche',
  landAddressComplement: null,
  landPostalCode: '07140',
  landCity: 'Les Vans',
  ...overrides,
})

describe('letterAddressLinesOf — adresse du courrier (ADR 067 §1-2)', () => {
  it('le domicile d’abord', () => {
    expect(letterAddressLinesOf(profile())).toEqual({
      source: 'home',
      lines: ['Marcel Laurent', '4 rue des Lilas', '69003 Lyon'],
    })
  })

  it('le terrain, faute de domicile', () => {
    expect(
      letterAddressLinesOf(
        profile({homeAddressLine: null, homePostalCode: null, homeCity: '  '})
      )
    ).toEqual({
      source: 'land',
      lines: ['Marcel Laurent', '12 chemin de la Fourche', '07140 Les Vans'],
    })
  })

  it('le nom seul, faute de domicile et de terrain', () => {
    expect(
      letterAddressLinesOf(
        profile({
          homeAddressLine: null,
          homePostalCode: null,
          homeCity: null,
          landAddressLine: null,
          landPostalCode: null,
          landCity: null,
        })
      )
    ).toEqual({source: 'name_only', lines: ['Marcel Laurent']})
  })

  it('le libellé d’entreprise s’il diffère du nom', () => {
    expect(
      letterAddressLinesOf(profile({companyName: 'SARL Laurent'})).lines
    ).toEqual([
      'Marcel Laurent',
      'SARL Laurent',
      '4 rue des Lilas',
      '69003 Lyon',
    ])
  })

  it('le libellé omis s’il égale le nom, sans casse ni espaces', () => {
    expect(
      letterAddressLinesOf(
        profile({name: 'SCI Les Chênes', companyName: ' sci  les chênes '})
      ).lines
    ).toEqual(['SCI Les Chênes', '4 rue des Lilas', '69003 Lyon'])
  })

  it('le complément sur sa ligne quand le bloc tient en 4 lignes', () => {
    expect(
      letterAddressLinesOf(profile({homeAddressComplement: 'Bâtiment B'})).lines
    ).toEqual(['Marcel Laurent', '4 rue des Lilas', 'Bâtiment B', '69003 Lyon'])
  })

  it('le complément fusionné à la ligne quand le bloc dépasserait 4 lignes', () => {
    const {lines} = letterAddressLinesOf(
      profile({companyName: 'SARL Laurent', homeAddressComplement: 'Bât. B'})
    )

    expect(lines).toEqual([
      'Marcel Laurent',
      'SARL Laurent',
      '4 rue des Lilas, Bât. B',
      '69003 Lyon',
    ])
  })

  it('une ligne vide est omise', () => {
    expect(
      letterAddressLinesOf(profile({homeAddressLine: ' ', homeCity: null}))
        .lines
    ).toEqual(['Marcel Laurent', '69003'])
  })
})

describe('sameNameAndHomeKeyOf — la clé de l’import (s13, s55)', () => {
  it('compare sans casse et espaces compactés', () => {
    expect(
      sameNameAndHomeKeyOf(' Jean  Dubois', '4 Rue des Lilas', '69003')
    ).toBe(sameNameAndHomeKeyOf('jean dubois', '4 rue  des lilas ', '69003'))
  })

  it('distingue un autre code postal', () => {
    expect(sameNameAndHomeKeyOf('Jean', '4 rue', '69003')).not.toBe(
      sameNameAndHomeKeyOf('Jean', '4 rue', '69004')
    )
  })
})

describe('homonymGroupsOf — même nom et même domicile (critère 2)', () => {
  it('regroupe deux fiches de même nom et même domicile', () => {
    const groups = homonymGroupsOf([
      profile({id: 'p12'}),
      profile({id: 'p27', name: 'marcel  laurent'}),
      profile({id: 'x', name: 'Hélène Roy'}),
    ])

    expect(groups.map((group) => group.map((p) => p.id))).toEqual([
      ['p12', 'p27'],
    ])
  })

  it('une fiche sans domicile n’est jamais regroupée', () => {
    const noHome = {homeAddressLine: null, homePostalCode: null}

    expect(
      homonymGroupsOf([
        profile({id: 'a', ...noHome}),
        profile({id: 'b', ...noHome}),
      ])
    ).toEqual([])
  })

  it('aucun homonyme : aucun groupe', () => {
    expect(homonymGroupsOf([profile()])).toEqual([])
  })
})

describe('lettersOf — une lettre par fiche ou par personne (critères 1, 2)', () => {
  const profiles = [
    profile({id: 'p27'}),
    profile({id: 'roy', name: 'Hélène Roy'}),
    profile({id: 'p12'}),
    profile({id: 'dubois', name: 'Anne Dubois'}),
  ]
  const parcels = {p27: ['27'], p12: ['14', '9'], roy: ['3'], dubois: []}

  it('par terrain : une lettre par fiche, chacune avec ses parcelles, triées par nom', () => {
    const letters = lettersOf(profiles, 'per_land', parcels)

    expect(letters.map((letter) => letter.memberProfileIds)).toEqual([
      ['dubois'],
      ['roy'],
      ['p12'],
      ['p27'],
    ])
    expect(letters.map((letter) => letter.parcelle)).toEqual([
      '',
      '3',
      '9 et 14',
      '27',
    ])
  })

  it('par personne : une lettre par groupe d’homonymes, toutes ses parcelles en ordre numérique', () => {
    const letters = lettersOf(profiles, 'per_person', parcels)

    expect(letters.map((letter) => letter.memberProfileIds)).toEqual([
      ['dubois'],
      ['roy'],
      ['p12', 'p27'],
    ])
    expect(letters[2]).toMatchObject({
      name: 'Marcel Laurent',
      parcelle: '9, 14 et 27',
      address: {
        source: 'home',
        lines: ['Marcel Laurent', '4 rue des Lilas', '69003 Lyon'],
      },
    })
  })

  it('sans homonymes, les deux regroupements donnent les mêmes lettres', () => {
    const alone = profiles.filter((p) => p.id !== 'p27')

    expect(lettersOf(alone, 'per_person', parcels)).toEqual(
      lettersOf(alone, 'per_land', parcels)
    )
  })
})
