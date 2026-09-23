import {describe, expect, it} from 'vitest'

import {
  buildContentFileKey,
  CONTENT_FILE_SCOPES,
  ContentFileScopeConst,
  getContentFileFormatFromKey,
  isContentFileKeyAllowed,
  validateContentFile,
} from './content-file-types'
import {
  buildPageBlockFileKey,
  isPageBlockFileKeyAllowed,
} from './page-block-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const NEWS_ID = '33333333-3333-4333-8333-333333333333'
const PAGE_ID = '44444444-4444-4444-8444-444444444444'
const BLOCK_ID = '55555555-5555-4555-8555-555555555555'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])

describe('registre des portées de fichiers de contenu (ADR 023)', () => {
  it('déclare les pages et les actualités', () => {
    expect(CONTENT_FILE_SCOPES).toEqual(['pages', 'news'])
  })
})

describe('buildContentFileKey', () => {
  it("construit une clé d'actualité sous le préfixe de l'association", () => {
    const key = buildContentFileKey(
      ORG_ID,
      ContentFileScopeConst.NEWS,
      NEWS_ID,
      'image',
      'webp'
    )

    expect(key).toMatch(
      new RegExp(`^${ORG_ID}/news/${NEWS_ID}/image-[0-9a-f-]{36}\\.webp$`)
    )
    expect(isContentFileKeyAllowed(ORG_ID, key)).toBe(true)
  })

  it('refuse un identifiant qui ne serait pas un UUID', () => {
    expect(() =>
      buildContentFileKey(
        '../x',
        ContentFileScopeConst.NEWS,
        NEWS_ID,
        'image',
        'png'
      )
    ).toThrow()
    expect(() =>
      buildContentFileKey(
        ORG_ID,
        ContentFileScopeConst.NEWS,
        'a/b',
        'image',
        'png'
      )
    ).toThrow()
    expect(() =>
      buildContentFileKey(
        ORG_ID,
        ContentFileScopeConst.NEWS,
        NEWS_ID,
        '../x',
        'png'
      )
    ).toThrow()
  })

  it('la clé de page reste celle de s04, octet pour octet', () => {
    const key = buildPageBlockFileKey(ORG_ID, PAGE_ID, BLOCK_ID, 'png')

    expect(key).toMatch(
      new RegExp(`^${ORG_ID}/pages/${PAGE_ID}/${BLOCK_ID}-[0-9a-f-]{36}\\.png$`)
    )
    expect(isContentFileKeyAllowed(ORG_ID, key)).toBe(true)
    expect(isPageBlockFileKeyAllowed(ORG_ID, key)).toBe(true)
  })
})

describe('isContentFileKeyAllowed', () => {
  const newsKey = `${ORG_ID}/news/${NEWS_ID}/image-abc.png`

  it('accepte une clé de portée enregistrée', () => {
    expect(isContentFileKeyAllowed(ORG_ID, newsKey)).toBe(true)
    expect(
      isContentFileKeyAllowed(ORG_ID, `${ORG_ID}/pages/${PAGE_ID}/b-abc.pdf`)
    ).toBe(true)
  })

  it("refuse une clé d'une autre association", () => {
    expect(isContentFileKeyAllowed(OTHER_ORG_ID, newsKey)).toBe(false)
  })

  it('refuse une portée inconnue', () => {
    expect(
      isContentFileKeyAllowed(ORG_ID, `${ORG_ID}/identity/logo-abc.png`)
    ).toBe(false)
    expect(
      isContentFileKeyAllowed(ORG_ID, `${ORG_ID}/secret/${NEWS_ID}/a.png`)
    ).toBe(false)
  })

  it('refuse une remontée de chemin', () => {
    expect(
      isContentFileKeyAllowed(
        ORG_ID,
        `${ORG_ID}/news/${NEWS_ID}/../../${OTHER_ORG_ID}/news/x.png`
      )
    ).toBe(false)
  })

  it('refuse un segment vide', () => {
    expect(isContentFileKeyAllowed(ORG_ID, `${ORG_ID}/news//image.png`)).toBe(
      false
    )
  })

  it('refuse une extension inconnue', () => {
    expect(
      isContentFileKeyAllowed(ORG_ID, `${ORG_ID}/news/${NEWS_ID}/image-abc.svg`)
    ).toBe(false)
  })

  it('restreint à une portée quand on la précise', () => {
    expect(isPageBlockFileKeyAllowed(ORG_ID, newsKey)).toBe(false)
    expect(
      isContentFileKeyAllowed(ORG_ID, newsKey, [ContentFileScopeConst.PAGES])
    ).toBe(false)
  })
})

describe('format et signature', () => {
  it("relit le format depuis l'extension", () => {
    expect(getContentFileFormatFromKey('a/b/c.jpeg')).toBe('jpeg')
    expect(getContentFileFormatFromKey('a/b/c.exe')).toBeUndefined()
  })

  it('réemploie la validation par signature binaire de s04', () => {
    expect(validateContentFile('image', PNG_BYTES)).toEqual({
      valid: true,
      format: 'png',
    })
    expect(validateContentFile('document', PNG_BYTES)).toEqual({
      valid: false,
      reason: 'format',
    })
  })
})
