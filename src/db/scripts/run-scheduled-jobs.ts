#!/usr/bin/env node
/**
 * Un passage du planificateur (ADR 006, ADR 052) : les taches dues de toutes
 * les associations. `pnpm tsx src/db/scripts/run-scheduled-jobs.ts`, lance
 * toutes les cinq minutes par `asl-cms-planificateur.timer` (s26).
 *
 * Les services sont gardes par `server-only` : le script le neutralise par
 * `allowServerOnly()`, et a lui seul (ADR 044).
 */
import {pathToFileURL} from 'node:url'

import type {RunDueScheduledJobsResult} from '@/services/types/domain/scheduled-job-types'

import {allowServerOnly} from './allow-server-only'
import initDotEnv from './env'

/** Non nul des qu'une association a echoue : la minuterie le journalise. */
export const scheduledJobsExitCode = (
  result: RunDueScheduledJobsResult
): number => (result.failed.length > 0 ? 1 : 0)

const run = async () => {
  allowServerOnly()
  await initDotEnv()

  const {runDueScheduledJobsService} =
    await import('@/services/facades/scheduled-job-service-facade')
  const result = await runDueScheduledJobsService(new Date())
  console.log(
    `Taches traitees : ${result.processed} (associations : ${result.organizations})`
  )
  if (result.failed.length > 0) {
    console.error(
      `Passage en echec pour ${result.failed.length} association(s) : ${result.failed.join(', ')}`
    )
  }
  return scheduledJobsExitCode(result)
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  run()
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error('Echec du passage du planificateur', error)
      process.exit(1)
    })
}
