import {Blob as NodeBlob} from 'node:buffer'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/content-file-service-facade', () => ({
  readContentFileService: vi.fn(),
}))

import {GET as legacyPagesGET} from '@/app/api/pages/files/[...key]/route'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {readContentFileService} from '@/services/facades/content-file-service-facade'

import {GET} from './route'

const PINS_ID = '11111111-1111-4111-8111-111111111111'
const NEWS_KEY = `${PINS_ID}/news/33333333-3333-4333-8333-333333333333/image-abc.png`

const pins = {
  id: PINS_ID,
  name: 'ASL Les Pins',
  slug: 'asl-les-pins',
  domain: 'pins.test',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const call = async (key: string, handler = GET) =>
  await handler(new Request(`http://localhost/api/files/${key}`), {
    params: Promise.resolve({key: key.split('/')}),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(pins)
  vi.mocked(readContentFileService).mockImplementation(async (_org, key) => ({
    content: new NodeBlob([`contenu:${key}`]) as unknown as Blob,
    contentType: 'image/png',
  }))
})

describe('GET /api/files/[...key]', () => {
  it('sert le fichier avec son type, nosniff et un cache long', async () => {
    const response = await call(NEWS_KEY)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(`contenu:${NEWS_KEY}`)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('cache-control')).toContain('max-age=31536000')
    expect(response.headers.get('cache-control')).toContain('immutable')
    expect(readContentFileService).toHaveBeenCalledWith(PINS_ID, NEWS_KEY)
  })

  it('clé hors préfixe : 404 nosniff', async () => {
    vi.mocked(readContentFileService).mockRejectedValue(new Error('invalide'))

    const response = await call('autre/news/x/image.png')

    expect(response.status).toBe(404)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('domaine inconnu : 404 nosniff sans lecture', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const response = await call(NEWS_KEY)

    expect(response.status).toBe(404)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(readContentFileService).not.toHaveBeenCalled()
  })

  it('/api/pages/files est servie par le même gestionnaire', () => {
    expect(legacyPagesGET).toBe(GET)
  })
})
