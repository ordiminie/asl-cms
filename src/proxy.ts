import {getSessionCookie} from 'better-auth/cookies'
import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'
import createMiddleware from 'next-intl/middleware'

import {env} from '@/env'
import {
  isValidReferralCode,
  normalizeReferralCode,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  REFERRAL_QUERY_PARAM,
} from '@/lib/helper/referral-helper'

import {routing} from './i18n/routing'
import {stripLocalePrefix} from './lib/helper/locale-helper'

const intlMiddleware = createMiddleware(routing)

// Segments servis derrière une session : le groupe (app) et l'espace admin.
const AUTHENTICATED_SEGMENTS = [
  '/account',
  '/admin',
  '/chat',
  '/dashboard',
  '/team',
]

const localeOf = (pathname: string) => {
  const firstSegment = pathname.split('/')[1]
  return routing.locales.includes(
    firstSegment as (typeof routing.locales)[number]
  )
    ? firstSegment
    : routing.defaultLocale
}

const isAuthenticatedPath = (pathname: string, locale: string) => {
  const path = stripLocalePrefix(pathname, locale)
  return AUTHENTICATED_SEGMENTS.some(
    (segment) => path === segment || path.startsWith(`${segment}/`)
  )
}

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
  const locale = localeOf(pathname)
  if (isAuthenticatedPath(pathname, locale) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
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

  // Attribution d'affiliation : le premier ref rencontre gagne.
  // Le garde sur le cookie existant EST la règle first-touch — un second lien
  // affilié cliqué plus tard ne remplace pas le premier. Le paramètre n'est pas
  // retiré de l'URL ici : les pages publiques ne lisent pas searchParams, donc
  // il ne casse aucun prerender, et une redirection coûterait un aller-retour
  // sur chaque visite.
  const referralCode = searchParams.get(REFERRAL_QUERY_PARAM)
  if (
    env.NEXT_PUBLIC_AFFILIATE_TRACKING === 'cookie' &&
    isValidReferralCode(referralCode ?? undefined) &&
    !request.cookies.get(REFERRAL_COOKIE_NAME)
  ) {
    response.cookies.set(
      REFERRAL_COOKIE_NAME,
      normalizeReferralCode(referralCode as string),
      {
        path: '/',
        maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
        httpOnly: true,
        secure: request.nextUrl.protocol === 'https:',
        sameSite: 'lax',
      }
    )
  }

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
