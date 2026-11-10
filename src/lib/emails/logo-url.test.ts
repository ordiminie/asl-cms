import {describe, expect, it} from 'vitest'

import {pngLogoUrlOf} from './logo-url'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ORIGIN = 'https://asl-les-pins.test'
const VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('pngLogoUrlOf', () => {
  it('rend l’adresse absolue et versionnée d’un logo PNG', () => {
    expect(pngLogoUrlOf(`${ORG_ID}/identity/logo-${VERSION}.png`, ORIGIN)).toBe(
      `${ORIGIN}/api/identity/logo?v=${VERSION}`
    )
  })

  it('ne rend rien pour un logo WebP : l’email porte alors le nom seul', () => {
    expect(
      pngLogoUrlOf(`${ORG_ID}/identity/logo-${VERSION}.webp`, ORIGIN)
    ).toBeUndefined()
  })

  it('ne rend rien sans logo', () => {
    expect(pngLogoUrlOf(null, ORIGIN)).toBeUndefined()
    expect(pngLogoUrlOf(undefined, ORIGIN)).toBeUndefined()
  })
})
