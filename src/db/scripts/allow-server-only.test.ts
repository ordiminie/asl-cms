import {createRequire} from 'node:module'

import {afterEach, describe, expect, it} from 'vitest'

import {allowServerOnly} from './allow-server-only'

const nodeRequire = createRequire(import.meta.url)

const SERVER_ONLY_ERROR = /cannot be imported from a Client Component module/

describe('allowServerOnly — server-only dans les scripts (ADR 044)', () => {
  let restore: (() => void) | undefined

  afterEach(() => {
    restore?.()
    restore = undefined
  })

  it("sans l'appel, server-only leve l'erreur de Next", () => {
    expect(() => nodeRequire('server-only')).toThrow(SERVER_ONLY_ERROR)
  })

  it('apres l appel, server-only se charge en objet vide', () => {
    restore = allowServerOnly()

    expect(nodeRequire('server-only')).toEqual({})
  })

  it('apres l appel, les autres modules se chargent normalement', () => {
    restore = allowServerOnly()

    const path = nodeRequire('node:path') as typeof import('node:path')
    expect(path.join('a', 'b')).toBe(`a${path.sep}b`)
  })

  it("la fonction renvoyee retablit l'etat d'origine", () => {
    allowServerOnly()()

    expect(() => nodeRequire('server-only')).toThrow(SERVER_ONLY_ERROR)
  })
})
