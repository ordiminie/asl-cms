import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'
import createMiddleware from 'next-intl/middleware'

import {routing} from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

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

  // Obtenir le thème depuis le cookie
  let theme = request.cookies.get('theme')?.value || 'light'

  // Fallback pour iOS : vérifier les headers et préférences système
  if (!request.cookies.get('theme')) {
    const colorScheme = request.headers.get('sec-ch-prefers-color-scheme')
    const userAgent = request.headers.get('user-agent') || ''
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)

    if (isIOS && colorScheme === 'dark') {
      theme = 'dark'
    } else if (isIOS && colorScheme === 'light') {
      theme = 'light'
    }

    const acceptHeader = request.headers.get('accept') || ''
    if (acceptHeader.includes('prefers-color-scheme: dark')) {
      theme = 'dark'
    }
  }

  // Appeler le middleware i18n
  const response = intlMiddleware(request) || NextResponse.next()

  // Ajouter le header du thème pour Shiki
  response.headers.set('x-theme', theme)

  // Forcer le cookie theme sur la réponse (important pour iOS)
  if (!request.cookies.get('theme')) {
    response.cookies.set('theme', theme, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)', '/api/auth/error'],
}
