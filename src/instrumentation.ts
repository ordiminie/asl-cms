/* eslint-disable no-restricted-properties */

// Point d'entrée d'instrumentation de Next (convention du framework).
//
// `NEXT_RUNTIME` n'est pas une variable applicative : elle est posée par Next
// lui-même pour indiquer dans quel runtime le module s'exécute, et le module
// `@/env` n'est pas disponible ici. D'où la lecture directe de process.env.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Capture TOUTE erreur serveur — Server Component, Server Action, route
// handler, middleware. C'est le seul endroit qui les voit toutes : un
// `error.tsx` affiche une page de secours à l'utilisateur, il ne remonte rien.
export const onRequestError = Sentry.captureRequestError
