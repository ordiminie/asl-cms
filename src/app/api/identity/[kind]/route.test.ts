import {Blob as NodeBlob} from 'node:buffer'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/association-identity-service-facade', () => ({
  readAssociationIdentityFileService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {readAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'

import {GET} from './route'

const PINS_ID = '11111111-1111-4111-8111-111111111111'
const FOURCHE_ID = '22222222-2222-4222-8222-222222222222'
const PINS_LOGO = `${PINS_ID}/identity/logo-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`
const FOURCHE_LOGO = `${FOURCHE_ID}/identity/logo-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`
const PINS_FAVICON = `${PINS_ID}/identity/favicon-cccccccc-cccc-4ccc-8ccc-cccccccccccc.ico`

const tenantOf = (
  id: string,
  name: string,
  keys: {logo?: string | null; favicon?: string | null}
) => ({
  id,
  name,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  domain: `${id}.test`,
  enabledModules: [],
  logoKey: keys.logo ?? null,
  faviconKey: keys.favicon ?? null,
})

const pins = tenantOf(PINS_ID, 'ASL Les Pins', {
  logo: PINS_LOGO,
  favicon: PINS_FAVICON,
})
const fourche = tenantOf(FOURCHE_ID, 'La Fourche', {logo: FOURCHE_LOGO})

const call = async (kind: string, query = '') =>
  await GET(new Request(`http://localhost/api/identity/${kind}${query}`), {
    params: Promise.resolve({kind}),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(pins)
  vi.mocked(readAssociationIdentityFileService).mockImplementation(
    async (_organizationId, _kind, key) => ({
      content: new NodeBlob([`contenu:${key}`]) as unknown as Blob,
      contentType: key.endsWith('.png')
        ? 'image/png'
        : key.endsWith('.webp')
          ? 'image/webp'
          : 'image/x-icon',
    })
  )
})

describe('GET /api/identity/[kind] — un fichier par association du domaine', () => {
  it('deux domaines, deux logos distincts', async () => {
    const pinsResponse = await call('logo')
    vi.mocked(getCurrentTenantDal).mockResolvedValue(fourche)
    const fourcheResponse = await call('logo')

    expect(pinsResponse.status).toBe(200)
    expect(await pinsResponse.text()).toBe(`contenu:${PINS_LOGO}`)
    expect(fourcheResponse.status).toBe(200)
    expect(await fourcheResponse.text()).toBe(`contenu:${FOURCHE_LOGO}`)
    expect(readAssociationIdentityFileService).toHaveBeenCalledWith(
      PINS_ID,
      'logo',
      PINS_LOGO
    )
    expect(readAssociationIdentityFileService).toHaveBeenCalledWith(
      FOURCHE_ID,
      'logo',
      FOURCHE_LOGO
    )
  })

  it('sert le favicon televerse, distinct du logo', async () => {
    const response = await call('favicon')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(`contenu:${PINS_FAVICON}`)
    expect(response.headers.get('content-type')).toBe('image/x-icon')
  })
})

describe('GET /api/identity/[kind] — en-tetes', () => {
  it('porte le type du format valide et nosniff', async () => {
    const response = await call('logo')

    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('cache longtemps quand la requete porte la version courante', async () => {
    const response = await call(
      'logo',
      '?v=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )

    expect(response.headers.get('cache-control')).toContain('max-age=31536000')
    expect(response.headers.get('cache-control')).toContain('immutable')
  })

  it('ne cache pas longtemps sans version, ni avec une version perimee', async () => {
    const withoutVersion = await call('logo')
    const staleVersion = await call('logo', '?v=perimee')

    expect(withoutVersion.headers.get('cache-control')).toBe('no-cache')
    expect(staleVersion.headers.get('cache-control')).toBe('no-cache')
  })
})

describe('GET /api/identity/[kind] — replis', () => {
  it('logo absent : 404', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(
      tenantOf(PINS_ID, 'ASL Les Pins', {})
    )

    const response = await call('logo')

    expect(response.status).toBe(404)
    expect(readAssociationIdentityFileService).not.toHaveBeenCalled()
  })

  it('logo reference mais illisible sur disque : 404', async () => {
    vi.mocked(readAssociationIdentityFileService).mockRejectedValue(
      new Error('introuvable')
    )

    const response = await call('logo')

    expect(response.status).toBe(404)
  })

  it('favicon absent : monogramme SVG genere, propre a l association', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(fourche)

    const response = await call('favicon')
    const svg = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(svg).toMatch(/^<svg /)
    expect(svg).toContain('>LF</text>')
    expect(svg).toContain('#17849B')
    expect(svg).not.toContain('<script')
    expect(readAssociationIdentityFileService).not.toHaveBeenCalled()
  })

  it('le monogramme echappe les caracteres speciaux du nom', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(
      tenantOf(FOURCHE_ID, '<b Tilleuls', {})
    )

    const svg = await (await call('favicon')).text()

    expect(svg).toContain('>&lt;T</text>')
  })

  it('domaine inconnu : 404, pour le logo comme pour le favicon', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    expect((await call('logo')).status).toBe(404)
    expect((await call('favicon')).status).toBe(404)
    expect(readAssociationIdentityFileService).not.toHaveBeenCalled()
  })
})

describe('GET /api/identity/[kind] — chemins forges', () => {
  it.each([
    'logo/../..',
    '../logo',
    '..%2F..%2Fetc%2Fpasswd',
    '%2e%2e',
    '/etc/passwd',
    'LOGO',
    'logo.png',
    `${FOURCHE_ID}/identity/logo`,
    'banniere',
    '',
  ])('%j : 404 sans aucune lecture', async (kind) => {
    const response = await call(kind)

    expect(response.status).toBe(404)
    expect(getCurrentTenantDal).not.toHaveBeenCalled()
    expect(readAssociationIdentityFileService).not.toHaveBeenCalled()
  })
})
