/* eslint-disable no-restricted-properties */
// Ces fichiers sont chargés hors du contexte applicatif (par instrumentation.ts,
// avant que `@/env` ne soit disponible) : la lecture directe de process.env y
// est nécessaire.
// Runtime Node.js — chargé par src/instrumentation.ts.
// Suit la configuration recommandée par Sentry pour Next.js : erreurs +
// tracing. Les signaux additionnels (replay, logs, profiling) sont volontairement
// différés — on n'instrumente pas plus que nécessaire au premier jour.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// Sans DSN, aucune initialisation : l'application se comporte exactement comme
// si Sentry n'était pas installé. C'est ce qui rend l'intégration sûre dans un
// boilerplate distribué à des projets qui n'ont pas de compte Sentry.
if (dsn) {
  Sentry.init({
    dsn,
    // 100 % en développement pour voir ce qu'on fait, 10 % en production pour
    // ne pas épuiser le quota.
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
    // Attache la valeur des variables locales aux frames : sur une erreur de
    // pool ou de requête, c'est ce qui dit *avec quoi* ça a cassé.
    includeLocalVariables: true,
  })
}
