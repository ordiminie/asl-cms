import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({cookie: 'session=abc'})),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {api: {signOut: vi.fn()}},
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionAuth: vi.fn(),
}))
vi.mock('@/app/dal/user-dal', () => ({getPostLoginPathDal: vi.fn()}))

import {getPostLoginPathDal} from '@/app/dal/user-dal'
import {auth} from '@/lib/better-auth/auth'
import {
  getAuthUser,
  getSessionAuth,
} from '@/services/authentication/auth-service'

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

const openSession = {session: {userId: 'user-1'}, user: {id: 'user-1'}}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.signOut).mockResolvedValue(signedOut() as never)
  vi.mocked(getSessionAuth).mockResolvedValue(openSession as never)
  vi.mocked(getAuthUser).mockResolvedValue(undefined)
  vi.mocked(getPostLoginPathDal).mockResolvedValue(undefined)
})

describe('GET /login/acces-ferme — accès réellement fermé (s12d, écran D, ADR 038)', () => {
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

describe('GET /login/acces-ferme — accès ouvert', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue({id: 'user-1'} as never)
  })

  it('ne ferme pas la session et n’efface aucun cookie', async () => {
    const response = await GET()

    expect(auth.api.signOut).not.toHaveBeenCalled()
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('renvoie en 307 vers la destination après connexion, sans message', async () => {
    vi.mocked(getPostLoginPathDal).mockResolvedValue('/bureau/pages')

    const response = await GET()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/bureau/pages')
  })

  it('se replie sur /dashboard sans destination connue', async () => {
    const response = await GET()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/dashboard')
  })
})

describe('GET /login/acces-ferme — aucune session', () => {
  beforeEach(() => {
    vi.mocked(getSessionAuth).mockResolvedValue(null as never)
  })

  it('renvoie en 307 vers /login, sans message ni fermeture', async () => {
    const response = await GET()

    expect(auth.api.signOut).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/login')
  })
})
