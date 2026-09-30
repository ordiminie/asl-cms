import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({headers: vi.fn()}))

import {headers} from 'next/headers'

import {readVisitorIp} from './visitor-ip'

const requestHeaders = (values: Record<string, string>) =>
  vi
    .mocked(headers)
    .mockResolvedValue(
      new Headers(values) as Awaited<ReturnType<typeof headers>>
    )

describe('readVisitorIp — une seule règle de lecture d’IP (s08b décision B, s10 décision E)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lit la dernière entrée de x-forwarded-for, celle du proxy, jamais la première', async () => {
    requestHeaders({'x-forwarded-for': '198.51.100.99, 203.0.113.7'})

    expect(await readVisitorIp()).toBe('203.0.113.7')
  })

  it('ignore les entrées vides en fin de x-forwarded-for', async () => {
    requestHeaders({'x-forwarded-for': '203.0.113.7, , '})

    expect(await readVisitorIp()).toBe('203.0.113.7')
  })

  it('se rabat sur x-real-ip sans x-forwarded-for', async () => {
    requestHeaders({'x-real-ip': ' 203.0.113.8 '})

    expect(await readVisitorIp()).toBe('203.0.113.8')
  })

  it('rend undefined sans aucun en-tête d’adresse', async () => {
    requestHeaders({})

    expect(await readVisitorIp()).toBeUndefined()
  })
})
