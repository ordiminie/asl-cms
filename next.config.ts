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
      {
        protocol: 'https',
        hostname: 'your-project.supabase.co',
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
