import {describe, expect, it} from 'vitest'

import {orderMyProfiles} from './my-profiles-order-rules'

describe('orderMyProfiles — l’ordre des fiches d’un compte (ADR 054 §7)', () => {
  it('trie par premier numéro de parcelle actuelle, en ordre numérique français', () => {
    const ordered = orderMyProfiles([
      {id: 'c', currentParcelNumbers: ['31']},
      {id: 'a', currentParcelNumbers: ['27', '9']},
      {id: 'b', currentParcelNumbers: ['12']},
    ])

    expect(ordered.map((profile) => profile.id)).toEqual(['a', 'b', 'c'])
  })

  it('range les fiches sans parcelle actuelle en dernier', () => {
    const ordered = orderMyProfiles([
      {id: 'sans', currentParcelNumbers: []},
      {id: 'avec', currentParcelNumbers: ['100']},
    ])

    expect(ordered.map((profile) => profile.id)).toEqual(['avec', 'sans'])
  })

  it('départage par identifiant, de façon stable', () => {
    const ordered = orderMyProfiles([
      {id: 'z', currentParcelNumbers: []},
      {id: 'm', currentParcelNumbers: ['12']},
      {id: 'k', currentParcelNumbers: ['12']},
      {id: 'b', currentParcelNumbers: []},
    ])

    expect(ordered.map((profile) => profile.id)).toEqual(['k', 'm', 'b', 'z'])
  })

  it('ne modifie pas la liste reçue et garde les champs de chaque fiche', () => {
    const profiles = [
      {id: 'b', currentParcelNumbers: ['2'], name: 'SCI Les Pins'},
      {id: 'a', currentParcelNumbers: ['10'], name: 'Bernard Lefèvre'},
    ]

    const ordered = orderMyProfiles(profiles)

    expect(profiles.map((profile) => profile.id)).toEqual(['b', 'a'])
    expect(ordered[0]).toEqual({
      id: 'b',
      currentParcelNumbers: ['2'],
      name: 'SCI Les Pins',
    })
  })
})
