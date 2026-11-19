import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const config = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/env', () => ({env: config.env}))

import {getPennylaneClient} from './pennylane-client.server'

/** Le client de l'instance lit sa cle, et sa base en test seulement (s20). */
describe('getPennylaneClient', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({items: [], next_cursor: null}), {
        status: 200,
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    for (const key of Object.keys(config.env)) delete config.env[key]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('vise la vraie API avec la clé de l’instance', async () => {
    config.env.PENNYLANE_API_KEY = 'jeton'

    await getPennylaneClient().listCustomers()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://app.pennylane.com/api/external/v2/customers?limit=100'
    )
    expect(init.headers.authorization).toBe('Bearer jeton')
  })

  it('vise le faux serveur local quand la base est déclarée (e2e)', async () => {
    config.env.PENNYLANE_API_KEY = 'jeton'
    config.env.PENNYLANE_API_BASE_URL = 'http://127.0.0.1:4010/api/external/v2'

    await getPennylaneClient().listCustomers()

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:4010/api/external/v2/customers?limit=100'
    )
  })
})
