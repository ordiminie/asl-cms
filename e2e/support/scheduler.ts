/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {execFileSync} from 'node:child_process'

import {databaseUrl} from './database'

/**
 * Le vrai planificateur, lancé par son script comme la minuterie le ferait
 * (ADR 052), sur le patron de `campaigns.spec.ts`. Le sous-processus hérite
 * du transport `file` et de la boîte d'envoi du job CI.
 */
const SCHEDULER_SCRIPT = 'src/db/scripts/run-scheduled-jobs.ts'

export const runSchedulerProcess = (): string =>
  execFileSync('pnpm', ['tsx', SCHEDULER_SCRIPT], {
    env: {...process.env, DATABASE_URL: databaseUrl()},
    encoding: 'utf8',
    timeout: 90_000,
  })
