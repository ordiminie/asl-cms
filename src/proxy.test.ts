import {NextRequest} from 'next/server'
import {describe, expect, it} from 'vitest'

import middleware from './proxy'

const SESSION_COOKIE = 'better-auth.session_token=session-de-test'

const requestTo = (pathname: string, {session = false} = {}) =>
  new NextRequest(new URL(pathname, 'https://asl.example.fr'), {
    headers: session ? {cookie: SESSION_COOKIE} : {},
  })

const redirectTarget = (response: Response) => {
  const location = response.headers.get('location')
  return location ? new URL(location).pathname : null
}

describe('proxy — gating de session sans préfixe de langue (s43)', () => {
  it.each(['/bureau', '/bureau/membres', '/account/settings', '/admin'])(
    'renvoie un visiteur sans session de %s vers /login, sans préfixe',
    (pathname) => {
      const response = middleware(requestTo(pathname))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/login')
    }
  )

  it.each(['/bureau', '/bureau/membres'])(
    'laisse passer %s quand le cookie de session est présent',
    (pathname) => {
      const response = middleware(requestTo(pathname, {session: true}))

      expect(redirectTarget(response)).not.toBe('/login')
      expect(response.headers.get('location')).toBeNull()
    }
  )

  it.each(['/actualites', '/', '/contact', '/bureautique'])(
    'ne redirige pas la page publique %s sans session',
    (pathname) => {
      const response = middleware(requestTo(pathname))

      expect(response.headers.get('location')).toBeNull()
    }
  )
})

describe('proxy — clair seul, aucun thème calculé (ADR 033)', () => {
  it('ne pose ni en-tête x-theme ni cookie theme, même en sombre', () => {
    const request = new NextRequest(
      new URL('/actualites', 'https://asl.example.fr'),
      {
        headers: {
          'sec-ch-prefers-color-scheme': 'dark',
          'user-agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
      }
    )

    const response = middleware(request)

    expect(response.headers.get('x-theme')).toBeNull()
    expect(response.cookies.get('theme')).toBeUndefined()
  })
})
