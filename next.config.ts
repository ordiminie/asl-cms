/* eslint-disable no-restricted-properties */
// Ce fichier s'évalue avant que le module `@/env` ne soit disponible :
// process.env y est le seul accès possible aux variables.
import createMDX from '@next/mdx'
import {withSentryConfig} from '@sentry/nextjs'
import type {NextConfig} from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost'],
  pageExtensions: ['js', 'jsx', 'mdx', 'md', 'ts', 'tsx'],
  logging: {
    incomingRequests: {
      ignore: [/\/api\/auth\/magic-link\/verify/],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
      },
    ],
  },

  // Remplace experimental.useCache (retiré en Next 16) : active la directive
  // 'use cache', cacheLife/cacheTag, et le PPR par défaut.
  cacheComponents: true,

  experimental: {
    authInterrupts: true,
    taint: true,
    // Cette limite doit rester **au-dessus** du plus grand fichier que le
    // produit accepte, enveloppe multipart comprise : au-dessous, Next rejette
    // la requete AVANT toute validation, et le message « Il pese… » n'est
    // jamais rendu — l'interface annonce une limite que le serveur ne laisse
    // pas atteindre. Les plafonds sont CONTENT_FILE_MAX_BYTES : 5 Mo par image
    // et 10 Mo par document (le bloc PDF de s04 televerse lui aussi par Server
    // Action). 16 Mo couvre la somme des deux plus la marge des champs de
    // formulaire — c'est la decision ecrite dans docs/architecture.md, que s09
    // exige puisqu'il depose une affiche et un PDF dans la meme soumission. Un
    // test de garde compare cette valeur au plus grand plafond
    // (src/services/__tests__/board-member-service.test.ts).
    serverActions: {
      bodySizeLimit: '16mb',
    },
    // staleTimes survit à cacheComponents et alimente cacheLife.default.stale
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
}

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
})

const config = withNextIntl(withMDX(nextConfig))

// Sentry est optionnel dans le boilerplate : sans DSN, on exporte la
// configuration inchangée. Le plugin n'est jamais appliqué, le build est donc
// strictement identique à celui d'un projet sans Sentry — voir docs/sentry.md.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Sans jeton, l'upload des sourcemaps est simplement ignoré au lieu de
      // faire échouer le build.
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      // Contourne les bloqueurs de publicité, qui avalent une bonne part des
      // erreurs remontées depuis le navigateur.
      tunnelRoute: '/monitoring',
    })
  : config
