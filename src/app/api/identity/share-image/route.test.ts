import {Blob as NodeBlob} from 'node:buffer'

import {isValidElement, ReactElement, ReactNode} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const og = vi.hoisted(() => ({
  calls: [] as {element: ReactElement; options: Record<string, unknown>}[],
}))

vi.mock('server-only', () => ({}))
vi.mock('next/og', () => ({
  ImageResponse: class extends Response {
    constructor(
      element: ReactElement,
      options: {headers?: Record<string, string>} & Record<string, unknown>
    ) {
      og.calls.push({element, options})
      super('png', {
        headers: {'Content-Type': 'image/png', ...options.headers},
      })
    }
  },
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/services/facades/association-identity-service-facade', () => ({
  readAssociationIdentityFileService: vi.fn(),
}))
vi.mock('@/lib/files/resize-image', () => ({
  convertToPng: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
}))

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {convertToPng} from '@/lib/files/resize-image'
import {shareImageNameKey} from '@/lib/seo/resolve-metadata'
import {readAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'
import {getAssociationMonogram} from '@/services/types/domain/association-identity-types'
import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import {GET} from './route'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PNG_LOGO = `${ORG_ID}/identity/logo-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`
const WEBP_LOGO = `${ORG_ID}/identity/logo-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`

const tenantWith = (logoKey: string | null) => ({
  id: ORG_ID,
  name: 'Les Amis de l’Étang',
  slug: 'amis-etang',
  domain: 'lesamisdeletang.fr',
  enabledModules: [],
  logoKey,
  faviconKey: null,
})

const NAME_KEY = shareImageNameKey('Les Amis de l’Étang')

const call = (query = '') =>
  GET(new Request(`http://localhost/api/identity/share-image${query}`))

/** Tous les elements de l'arbre, a plat. */
const elementsOf = (node: ReactNode): ReactElement[] => {
  if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child))
  if (!isValidElement(node)) return []
  const props = node.props as {children?: ReactNode}
  return [node, ...elementsOf(props.children)]
}

const textsOf = (node: ReactNode): string[] => {
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap((child) => textsOf(child))
  if (!isValidElement(node)) return []
  return textsOf((node.props as {children?: ReactNode}).children)
}

const rendered = () => og.calls.at(-1)?.element as ReactElement
const styleOf = (element: ReactElement) =>
  (element.props as {style?: Record<string, unknown>}).style ?? {}

const settingsWithHue = (hue?: string) =>
  resolveSettings(
    ASSOCIATION_SETTINGS_REGISTRY,
    hue ? [{key: ACCENT_HUE_SETTING_KEY, value: hue}] : []
  )

beforeEach(() => {
  vi.clearAllMocks()
  og.calls.length = 0
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantWith(null))
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(settingsWithHue())
  vi.mocked(readAssociationIdentityFileService).mockImplementation(
    async (_organizationId, _kind, key) => ({
      content: new NodeBlob([`contenu:${key}`]) as unknown as Blob,
      contentType: key.endsWith('.png') ? 'image/png' : 'image/webp',
    })
  )
})

describe('GET /api/identity/share-image — image de repli (s11)', () => {
  it('rend une image PNG 1200 x 630, avec la police Source Serif 4 versee au depot', async () => {
    const response = await call('?h=195')

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    const {options} = og.calls[0]
    expect(options).toMatchObject({width: 1200, height: 630})
    const [font] = options.fonts as {
      name: string
      weight: number
      data: ArrayBuffer
    }[]
    expect(font).toMatchObject({name: 'Source Serif 4', weight: 600})
    expect(font.data.byteLength).toBeGreaterThan(1000)
  })

  it('cle courante (teinte, logo et nom) : cache public long', async () => {
    const response = await call(`?h=195&n=${NAME_KEY}`)

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    )
  })

  it('nom perime ou absent : cache public sans duree (revue s11, m3)', async () => {
    for (const query of ['?h=195', '?h=195&n=autre']) {
      const response = await call(query)

      expect(response.headers.get('Cache-Control')).toBe('public, no-cache')
    }
  })

  it('cle perimee : cache public sans duree, pour ne pas figer une ancienne image', async () => {
    const response = await call('?h=40')

    expect(response.headers.get('Cache-Control')).toBe('public, no-cache')
  })

  it('sans logo : le monogramme de <AssociationMark />, et le nom', async () => {
    await call('?h=195')

    const texts = textsOf(rendered())
    expect(texts).toContain(getAssociationMonogram('Les Amis de l’Étang'))
    expect(texts).toContain('Les Amis de l’Étang')
    expect(
      elementsOf(rendered()).some((element) => element.type === 'img')
    ).toBe(false)
    expect(readAssociationIdentityFileService).not.toHaveBeenCalled()
  })

  it('logo PNG : l image du logo, sans conversion', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantWith(PNG_LOGO))

    await call('?v=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&h=195')

    const image = elementsOf(rendered()).find(
      (element) => element.type === 'img'
    )
    expect((image?.props as {src: string}).src).toMatch(
      /^data:image\/png;base64,/
    )
    expect(convertToPng).not.toHaveBeenCalled()
    expect(textsOf(rendered())).not.toContain(
      getAssociationMonogram('Les Amis de l’Étang')
    )
  })

  it('logo WebP : converti en PNG, que le rendu sait lire', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantWith(WEBP_LOGO))

    await call('?v=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&h=195')

    expect(convertToPng).toHaveBeenCalledTimes(1)
    const image = elementsOf(rendered()).find(
      (element) => element.type === 'img'
    )
    expect((image?.props as {src: string}).src).toBe(
      'data:image/png;base64,iVBORw=='
    )
  })

  it.each([
    ['195', '#E8F5F8', '#185A66'],
    ['40', '#F8EDE6', '#5E3421'],
  ])('teinte %s : surface %s et encre %s', async (hue, surface, ink) => {
    vi.mocked(getAssociationSettingsDal).mockResolvedValue(settingsWithHue(hue))

    await call(`?h=${hue}`)

    expect(styleOf(rendered())).toMatchObject({backgroundColor: surface})
    const name = elementsOf(rendered()).find((element) =>
      textsOf(element).includes('Les Amis de l’Étang')
    )
    const nameElement = elementsOf(name)
      .filter((element) => styleOf(element).color)
      .at(-1)
    expect(styleOf(nameElement as ReactElement)).toMatchObject({color: ink})
  })

  it('domaine qui ne sert aucune association : 404, aucune image', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const response = await call('?h=195')

    expect(response.status).toBe(404)
    expect(og.calls).toHaveLength(0)
  })
})
