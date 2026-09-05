// Runtime navigateur. Next charge ce fichier automatiquement — il ne passe pas
// par src/instrumentation.ts, qui ne couvre que le serveur.
import * as Sentry from '@sentry/nextjs'

import {env} from '@/env'

const dsn = env.NEXT_PUBLIC_SENTRY_DSN

// Sans DSN, le SDK n'est pas initialisé : aucune requête réseau, aucune donnée
// envoyée depuis le navigateur du visiteur.
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: env.NEXT_PUBLIC_NODE_ENV === 'development' ? 1 : 0.1,
  })
}

// Rattache les navigations de l'App Router aux traces. Exporté dans tous les
// cas : Next attend ce symbole, et sans init le SDK n'émet rien.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
