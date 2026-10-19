import {describe, expect, it} from 'vitest'

import {readSmokeTargets} from './smoke-targets'

const complete = {
  SMOKE_DOMAIN_A: 'a.exemple.test',
  SMOKE_DOMAIN_B: 'b.exemple.test',
  SMOKE_NAME_A: 'ASL Alpha',
  SMOKE_NAME_B: 'ASL Beta',
  SMOKE_UNKNOWN_DOMAIN: 'inconnu.exemple.test',
}

describe('readSmokeTargets — cibles du test de fumée', () => {
  it('lit les deux associations et le domaine inconnu', () => {
    expect(readSmokeTargets(complete)).toEqual({
      associations: [
        {domain: 'a.exemple.test', name: 'ASL Alpha'},
        {domain: 'b.exemple.test', name: 'ASL Beta'},
      ],
      unknownDomain: 'inconnu.exemple.test',
    })
  })

  it('nomme chaque variable manquante ou vide', () => {
    expect(() =>
      readSmokeTargets({
        ...complete,
        SMOKE_NAME_B: '',
        SMOKE_DOMAIN_A: undefined,
      })
    ).toThrow(/SMOKE_DOMAIN_A.*SMOKE_NAME_B/)
  })

  it('refuse un domaine écrit avec son protocole ou un chemin', () => {
    expect(() =>
      readSmokeTargets({...complete, SMOKE_DOMAIN_B: 'https://b.exemple.test/'})
    ).toThrow(/SMOKE_DOMAIN_B/)
  })

  it('refuse deux associations sur le même domaine ou sous le même nom', () => {
    expect(() =>
      readSmokeTargets({...complete, SMOKE_DOMAIN_B: 'a.exemple.test'})
    ).toThrow(/distincts/)
    expect(() =>
      readSmokeTargets({...complete, SMOKE_NAME_B: 'ASL Alpha'})
    ).toThrow(/distincts/)
  })
})
