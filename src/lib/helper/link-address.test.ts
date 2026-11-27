import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {classifyLinkAddress} from './link-address'

describe('classifyLinkAddress', () => {
  it.each([
    ['/contact', '/contact'],
    ['/actualites?page=2', '/actualites?page=2'],
    ['/#contact', '/#contact'],
    ['/', '/'],
    ['  /contact  ', '/contact'],
  ])('accepte le chemin interne %j', (raw, address) => {
    expect(classifyLinkAddress(raw)).toEqual({
      ok: true,
      kind: 'internal',
      address,
    })
  })

  it.each([
    'https://www.saint-etang.fr',
    'HTTPS://x.fr',
    'https://x.fr/a?b=c#d',
  ])('accepte l adresse externe %j, telle que saisie', (raw) => {
    expect(classifyLinkAddress(raw)).toEqual({
      ok: true,
      kind: 'external',
      address: raw,
    })
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'mailto:a@b.fr',
    '//hôte',
    '/\\hôte',
    '\\\\hôte',
    '\\/hôte',
    ' //hôte',
    '\t/x',
    '/x\ny',
    '/a b',
    'https:/hôte',
    'https:\\\\hôte',
    'https://',
    'https://a@b.fr',
    'https://a:b@c.fr',
    'ftp://x',
    'contact',
    'www.x.fr',
  ])('refuse %j', (raw) => {
    expect(classifyLinkAddress(raw)).toEqual({ok: false, reason: 'refused'})
  })

  it.each(['http://x.fr', 'HTTP://x.fr'])(
    'refuse %j avec la raison http, sans l accepter',
    (raw) => {
      expect(classifyLinkAddress(raw)).toEqual({ok: false, reason: 'http'})
    }
  )

  it.each(['', '   '])('refuse %j comme vide', (raw) => {
    expect(classifyLinkAddress(raw)).toEqual({ok: false, reason: 'empty'})
  })
})

describe('classifyLinkAddress sans URL.canParse (Safari 16.4, cible de Next 16)', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'canParse', {
      value: undefined,
      configurable: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(URL, 'canParse')
  })

  it('simule bien un navigateur sans URL.canParse', () => {
    expect(URL.canParse).toBeUndefined()
  })

  it('accepte une adresse externe en https://', () => {
    expect(classifyLinkAddress('https://www.saint-etang.fr')).toEqual({
      ok: true,
      kind: 'external',
      address: 'https://www.saint-etang.fr',
    })
  })

  it.each(['https://', 'https://a@b.fr'])(
    'refuse %j sans lever d erreur',
    (raw) => {
      expect(classifyLinkAddress(raw)).toEqual({ok: false, reason: 'refused'})
    }
  )
})
