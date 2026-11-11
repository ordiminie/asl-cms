import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/unsubscribe-service-facade', () => ({
  confirmUnsubscribeService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {confirmUnsubscribeService} from '@/services/facades/unsubscribe-service-facade'

import {GET, POST} from './route'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')
const URL_OF = `https://asl-les-pins.test/api/campaigns/unsubscribe/${TOKEN}`

const call = (handler: typeof GET, method: string) =>
  handler(new Request(URL_OF, {method}), {
    params: Promise.resolve({jeton: TOKEN}),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(confirmUnsubscribeService).mockResolvedValue({
    status: 'unsubscribed',
  })
})

describe('GET — préchargé par les antivirus : n’écrit jamais', () => {
  it('redirige vers la page publique de confirmation, sans rien écrire', async () => {
    const response = await call(GET, 'GET')

    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe(`/desinscription/${TOKEN}`)
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(confirmUnsubscribeService).not.toHaveBeenCalled()
  })
})

describe('POST — sans interaction (RFC 8058)', () => {
  it('écrit une fois, dans le tenant du domaine appelé', async () => {
    const response = await call(POST, 'POST')

    expect(response.status).toBe(200)
    expect(confirmUnsubscribeService).toHaveBeenCalledTimes(1)
    expect(confirmUnsubscribeService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      token: TOKEN,
    })
  })

  it('déjà désinscrit → 200, sans détail', async () => {
    vi.mocked(confirmUnsubscribeService).mockResolvedValue({status: 'already'})

    const response = await call(POST, 'POST')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })

  it('jeton d’une autre association (introuvable sous la RLS) → refus neutre', async () => {
    vi.mocked(confirmUnsubscribeService).mockResolvedValue({status: 'invalid'})

    const response = await call(POST, 'POST')

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })

  it('domaine sans association → refus neutre, rien n’est écrit', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const response = await call(POST, 'POST')

    expect(response.status).toBe(404)
    expect(confirmUnsubscribeService).not.toHaveBeenCalled()
  })

  it('échec technique → 500 sans détail', async () => {
    vi.mocked(confirmUnsubscribeService).mockRejectedValue(new Error(TOKEN))

    const response = await call(POST, 'POST')

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('')
  })
})
