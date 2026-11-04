#!/usr/bin/env node
/**
 * Purge des empreintes de limitation de debit de plus de 24 h, toutes
 * associations (s08b, critere 3) : `pnpm tsx
 * src/db/scripts/purge-rate-limit-fingerprints.ts`. Point d'entree « appelable
 * seul », hors de toute requete : s12b y branche son declencheur quotidien.
 *
 * Les services sont gardes par `server-only` : le script le neutralise par
 * `allowServerOnly()`, et a lui seul (ADR 044).
 */
import {allowServerOnly} from './allow-server-only'
import initDotEnv from './env'

allowServerOnly()
initDotEnv()

const purge = async () => {
  const {purgeExpiredRateLimitFingerprintsService} =
    await import('@/services/facades/rate-limit-service-facade')
  const {organizations, deleted, failed} =
    await purgeExpiredRateLimitFingerprintsService()
  console.log(
    `Empreintes purgees : ${deleted} (associations : ${organizations})`
  )
  if (failed.length > 0) {
    console.error(
      `Purge en echec pour ${failed.length} association(s) : ${failed.join(', ')}`
    )
    return 1
  }
  return 0
}

purge()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('Echec de la purge des empreintes', error)
    process.exit(1)
  })
