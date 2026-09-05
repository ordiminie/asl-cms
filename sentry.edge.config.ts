/* eslint-disable no-restricted-properties */
// Ces fichiers sont chargés hors du contexte applicatif (par instrumentation.ts,
// avant que `@/env` ne soit disponible) : la lecture directe de process.env y
// est nécessaire.
// Runtime Edge (middleware) — chargé par src/instrumentation.ts.
// Configuration volontairement plus légère que celle du serveur : le runtime
// Edge n'a pas accès aux API Node, `includeLocalVariables` n'y existe pas.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  })
}
