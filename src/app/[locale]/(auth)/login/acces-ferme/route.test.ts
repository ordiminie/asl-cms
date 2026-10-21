import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({cookie: 'session=abc'})),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {api: {signOut: vi.fn()}},
}))

import {auth} from '@/lib/better-auth/auth'

import {GET} from './route'

const signedOut = () => {
  const headers = new Headers()
  headers.append(
    'set-cookie',
    'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly'
  )
  headers.append(
    'set-cookie',
    'better-auth.session_data=; Max-Age=0; Path=/; HttpOnly'
  )
  return new Response(JSON.stringify({success: true}), {headers})
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.signOut).mockResolvedValue(signedOut() as never)
})

describe('GET /login/acces-ferme (s12d, écran D, ADR 038)', () => {
  it('ferme la session courante par Better Auth', async () => {
    await GET()

    expect(auth.api.signOut).toHaveBeenCalledWith(
      expect.objectContaining({asResponse: true, headers: expect.any(Headers)})
    )
  })

  it('efface les cookies de session dans la réponse', async () => {
    const response = await GET()

    expect(response.headers.getSetCookie()).toEqual([
      'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly',
      'better-auth.session_data=; Max-Age=0; Path=/; HttpOnly',
    ])
  })

  it('renvoie en 307 vers /login?acces=ferme, adresse relative', async () => {
    const response = await GET()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/login?acces=ferme')
  })

  it('renvoie quand même vers le message si la fermeture échoue', async () => {
    vi.mocked(auth.api.signOut).mockRejectedValue(new Error('base absente'))

    const response = await GET()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/login?acces=ferme')
  })
})
