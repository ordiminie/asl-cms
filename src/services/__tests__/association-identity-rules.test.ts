import {describe, expect, it} from 'vitest'

import {
  buildAssociationIdentityKey,
  describeFileSize,
  detectIdentityFileFormat,
  getAssociationMonogram,
  getIdentityFormatFromKey,
  getIdentityVersionFromKey,
  IDENTITY_MAX_BYTES,
  validateAssociationIdentityFile,
} from '../types/domain/association-identity-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const bytes = (...values: number[]) => new Uint8Array(values)
const withPadding = (head: Uint8Array, total = 64) => {
  const buffer = new Uint8Array(total)
  buffer.set(head)
  return buffer
}
const text = (value: string) => new TextEncoder().encode(value)

const PNG = withPadding(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
const WEBP = withPadding(
  bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50)
)
const ICO = withPadding(bytes(0x00, 0x00, 0x01, 0x00, 0x01, 0x00))
const JPEG = withPadding(bytes(0xff, 0xd8, 0xff, 0xe0))
const GIF = withPadding(text('GIF89a'))
const SVG = text(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'
)
const RIFF_NOT_WEBP = withPadding(
  bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45)
)
const FAKE_PNG = text('ceci n est pas un png, malgre son extension')

describe('detectIdentityFileFormat — par signature binaire', () => {
  it.each([
    ['png', PNG],
    ['webp', WEBP],
    ['ico', ICO],
    ['jpeg', JPEG],
    ['gif', GIF],
    ['svg', SVG],
  ])('reconnait %s', (format, content) => {
    expect(detectIdentityFileFormat(content)).toBe(format)
  })

  it('ne prend pas un RIFF quelconque (WAV) pour du WebP', () => {
    expect(detectIdentityFileFormat(RIFF_NOT_WEBP)).toBeUndefined()
  })

  it('ne reconnait rien dans un faux PNG ni dans un fichier vide', () => {
    expect(detectIdentityFileFormat(FAKE_PNG)).toBeUndefined()
    expect(detectIdentityFileFormat(new Uint8Array())).toBeUndefined()
  })
})

describe('validateAssociationIdentityFile — logo', () => {
  it.each([
    ['png', PNG],
    ['webp', WEBP],
  ])('accepte un logo %s', (format, content) => {
    expect(validateAssociationIdentityFile('logo', content)).toEqual({
      valid: true,
      format,
    })
  })

  it.each([
    ['jpeg', JPEG],
    ['svg', SVG],
    ['ico', ICO],
    ['gif', GIF],
  ])('refuse un logo %s en nommant son format', (format, content) => {
    expect(validateAssociationIdentityFile('logo', content)).toEqual({
      valid: false,
      reason: 'format',
      detectedFormat: format,
    })
  })

  it('juge le contenu, pas le nom : un PNG renomme .webp est un PNG', () => {
    // Le nom et le type declares ne sont jamais lus : seul le contenu compte.
    expect(validateAssociationIdentityFile('logo', PNG)).toEqual({
      valid: true,
      format: 'png',
    })
  })

  it('refuse un faux PNG, sans format reconnu', () => {
    expect(validateAssociationIdentityFile('logo', FAKE_PNG)).toEqual({
      valid: false,
      reason: 'format',
      detectedFormat: undefined,
    })
  })

  it('accepte un logo de 1 Mo exactement, refuse au-dela', () => {
    const atLimit = withPadding(PNG.slice(0, 8), 1024 * 1024)
    const overLimit = withPadding(PNG.slice(0, 8), 1024 * 1024 + 1)

    expect(IDENTITY_MAX_BYTES.logo).toBe(1024 * 1024)
    expect(validateAssociationIdentityFile('logo', atLimit).valid).toBe(true)
    expect(validateAssociationIdentityFile('logo', overLimit)).toEqual({
      valid: false,
      reason: 'size',
      size: 1024 * 1024 + 1,
      maxBytes: 1024 * 1024,
    })
  })
})

describe('validateAssociationIdentityFile — favicon', () => {
  it.each([
    ['png', PNG],
    ['ico', ICO],
  ])('accepte un favicon %s', (format, content) => {
    expect(validateAssociationIdentityFile('favicon', content)).toEqual({
      valid: true,
      format,
    })
  })

  it.each([
    ['webp', WEBP],
    ['jpeg', JPEG],
    ['svg', SVG],
  ])('refuse un favicon %s', (format, content) => {
    expect(validateAssociationIdentityFile('favicon', content)).toEqual({
      valid: false,
      reason: 'format',
      detectedFormat: format,
    })
  })

  it('accepte un favicon de 200 Ko exactement, refuse au-dela', () => {
    const atLimit = withPadding(ICO.slice(0, 6), 200 * 1024)
    const overLimit = withPadding(ICO.slice(0, 6), 200 * 1024 + 1)

    expect(IDENTITY_MAX_BYTES.favicon).toBe(200 * 1024)
    expect(validateAssociationIdentityFile('favicon', atLimit).valid).toBe(true)
    expect(validateAssociationIdentityFile('favicon', overLimit)).toMatchObject(
      {valid: false, reason: 'size', maxBytes: 200 * 1024}
    )
  })
})

describe('buildAssociationIdentityKey — ADR 015', () => {
  it('range le fichier sous le prefixe de l organisation, sans nom fourni', () => {
    const key = buildAssociationIdentityKey(ORG_ID, 'logo', 'png')

    expect(key).toMatch(
      new RegExp(
        `^${ORG_ID}/identity/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`
      )
    )
  })

  it('produit une nouvelle cle a chaque televersement', () => {
    expect(buildAssociationIdentityKey(ORG_ID, 'favicon', 'ico')).not.toBe(
      buildAssociationIdentityKey(ORG_ID, 'favicon', 'ico')
    )
  })

  it('deux associations obtiennent deux emplacements distincts', () => {
    const other = '22222222-2222-4222-8222-222222222222'

    expect(buildAssociationIdentityKey(ORG_ID, 'logo', 'png')).toMatch(
      new RegExp(`^${ORG_ID}/`)
    )
    expect(buildAssociationIdentityKey(other, 'logo', 'png')).toMatch(
      new RegExp(`^${other}/`)
    )
  })

  it('refuse un identifiant d organisation qui n est pas un UUID', () => {
    expect(() =>
      buildAssociationIdentityKey('../autre', 'logo', 'png')
    ).toThrow()
  })
})

describe('getIdentityFormatFromKey', () => {
  it.each([
    [`${ORG_ID}/identity/logo-a.png`, 'png'],
    [`${ORG_ID}/identity/logo-a.webp`, 'webp'],
    [`${ORG_ID}/identity/favicon-a.ico`, 'ico'],
  ])('lit le format valide de %s', (key, format) => {
    expect(getIdentityFormatFromKey(key)).toBe(format)
  })

  it('ne rend aucun format pour une extension non acceptee', () => {
    expect(
      getIdentityFormatFromKey(`${ORG_ID}/identity/logo-a.svg`)
    ).toBeUndefined()
  })
})

describe('getAssociationMonogram', () => {
  it.each([
    ['La Fourche', 'LF'],
    ['ASL Les Pins', 'LP'],
    ['asl les pins', 'LP'],
    ['Marketing Pro', 'MP'],
    ['TechCorp Solutions Group', 'TS'],
    ['Oasis', 'OA'],
    ['ASL', 'AS'],
    ['  étang   bleu ', 'ÉB'],
  ])('%j donne %j', (name, monogram) => {
    expect(getAssociationMonogram(name)).toBe(monogram)
  })
})

describe('getIdentityVersionFromKey', () => {
  it('tire la version de la cle : l identifiant unique du fichier', () => {
    expect(
      getIdentityVersionFromKey(
        `${ORG_ID}/identity/logo-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`
      )
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('ne rend aucune version sans cle', () => {
    expect(getIdentityVersionFromKey(null)).toBeUndefined()
  })
})

describe('describeFileSize', () => {
  it.each([
    [1024 * 1024, {unit: 'megabytes', value: 1}],
    [Math.round(3.2 * 1024 * 1024), {unit: 'megabytes', value: 3.2}],
    [200 * 1024, {unit: 'kilobytes', value: 200}],
    [300, {unit: 'kilobytes', value: 0.3}],
  ])('%i octets', (bytes, expected) => {
    expect(describeFileSize(bytes)).toEqual(expected)
  })
})
