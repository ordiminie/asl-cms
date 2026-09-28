#!/usr/bin/env node
/**
 * Purge des empreintes de limitation de debit de plus de 24 h, toutes
 * associations (s08b, critere 3) : `pnpm tsx
 * src/db/scripts/purge-rate-limit-fingerprints.ts`. Point d'entree « appelable
 * seul », hors de toute requete : s12b y branche son declencheur quotidien.
 *
 * Les services sont gardes par `server-only`, que Next resout sous la condition
 * `react-server` : le script lui donne la meme resolution, et a lui seul.
 */
import {registerHooks} from 'node:module'

import initDotEnv from './env'

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    specifier === 'server-only'
      ? nextResolve(specifier, {
          ...context,
          conditions: [...context.conditions, 'react-server'],
        })
      : nextResolve(specifier, context),
})
initDotEnv()

const purge = async () => {
  const {purgeExpiredRateLimitFingerprintsService} =
    await import('@/services/facades/rate-limit-service-facade')
  const {organizations, deleted} =
    await purgeExpiredRateLimitFingerprintsService()
  console.log(
    `Empreintes purgees : ${deleted} (associations : ${organizations})`
  )
}

purge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Echec de la purge des empreintes', error)
    process.exit(1)
  })
