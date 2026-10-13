import {getSessionCookie} from 'better-auth/cookies'
import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'
import createMiddleware from 'next-intl/middleware'

import {routing} from './i18n/routing'
import {AUTHENTICATED_SEGMENTS} from './lib/routing/authenticated-segments'

const intlMiddleware = createMiddleware(routing)

const isAuthenticatedPath = (pathname: string) =>
  AUTHENTICATED_SEGMENTS.some(
    (segment) => pathname === segment || pathname.startsWith(`${segment}/`)
  )

export default function middleware(request: NextRequest) {
  const {pathname, searchParams} = request.nextUrl

  // Intercepter la page d'erreur Better Auth et rediriger vers notre page personnalisée
  if (pathname === '/api/auth/error') {
    const error = searchParams.get('error') || 'unknown'
    const errorDescription = searchParams.get('error_description') || ''

    const redirectUrl = new URL('/auth-error', request.url)
    redirectUrl.searchParams.set('error', error)
    if (errorDescription) {
      redirectUrl.searchParams.set('message', errorDescription)
    }

    return NextResponse.redirect(redirectUrl)
  }

  // Gating grossier : sans cookie de session, inutile de rendre une route
  // authentifiée. C'est ce qui permet à ces routes de streamer — sous Cache
  // Components, un `redirect()` déclenché pendant le stream part après le début
  // d'un 200 et ne peut plus changer le statut.
  // Contrôle optimiste, sans appel base : la présence du cookie ne prouve pas
  // que la session est valide. La vraie vérification reste côté serveur —
  // getCurrentUserDal, withAuth et l'autorisation CASL dans les services.
  // Locale unique sans prefixe (ADR 008) : les adresses prefixees /fr, /en,
  // /es sont redirigees par next.config.ts avant le proxy (ADR 031), le chemin
  // recu ici est donc toujours sans prefixe.
  if (isAuthenticatedPath(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return intlMiddleware(request) || NextResponse.next()
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … `/monitoring`, le tunnel de Sentry : c'est un endpoint technique
  //   appelé par le SDK navigateur, pas une page. Sans cette exclusion, l'i18n
  //   le réécrit en `/fr/monitoring` — une route qui n'existe pas, d'où des
  //   POST en 404 et, surtout, aucune erreur client remontée. Sans Sentry
  //   configuré, cette exclusion est simplement sans effet.
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: [
    '/((?!api|trpc|_next|_vercel|monitoring|.*\\..*).*)',
    '/api/auth/error',
  ],
}
