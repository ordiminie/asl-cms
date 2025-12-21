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

  return intlMiddleware(request)
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)', '/api/auth/error'],
}
