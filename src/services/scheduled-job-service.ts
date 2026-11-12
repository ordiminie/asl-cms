import 'server-only'

import {z} from 'zod'

import {getAllOrganizationIdsDao} from '@/db/repositories/organization-repository'
import {
  claimDueJobsTxnDao,
  completeJobTxnDao,
  failJobTxnDao,
  releaseJobTxnDao,
  rescheduleJobTxnDao,
} from '@/db/repositories/scheduled-job-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'

import {ValidationParsedZodError} from './errors/validation-error'
import {
  RunDueScheduledJobsInput,
  RunDueScheduledJobsResult,
  SCHEDULED_JOB_LOCK_STALE_MS,
  SCHEDULED_JOBS_BATCH_SIZE,
  ScheduledJob,
  ScheduledJobHandlers,
  ScheduledJobOutcome,
} from './types/domain/scheduled-job-types'

/**
 * Planificateur en base (ADR 006, ADR 052), **sans session** : lance par le
 * script de la minuterie ou par le passage immediat d'une creation. Un
 * `withTenant` par association, jamais `withRlsBypass`. La prise est une
 * transaction courte ; chaque tache s'execute ensuite hors verrou. Un echec
 * dans une association n'arrete pas les autres.
 */

const organizationIdSchema = z.string().uuid().optional()

type ClaimedJobRow = {
  id: string
  organizationId: string
  kind: string
  payload: Record<string, string>
  attempts: number
  previousLockedAt: Date | null
}

const toScheduledJob = (row: ClaimedJobRow): ScheduledJob => ({
  id: row.id,
  organizationId: row.organizationId,
  kind: row.kind,
  payload: row.payload,
  attempts: row.attempts,
  resumedAfterStaleLock: row.previousLockedAt !== null,
})

const writeOutcome = async (
  jobId: string,
  outcome: ScheduledJobOutcome
): Promise<void> => {
  switch (outcome.status) {
    case 'completed':
      return completeJobTxnDao(jobId)
    case 'retry':
      return rescheduleJobTxnDao(jobId, outcome.runAfter)
    case 'failed':
      return failJobTxnDao(jobId)
    case 'released':
      return releaseJobTxnDao(jobId)
  }
}

/**
 * Les taches dues d'une association. Une tache dont le gestionnaire leve une
 * erreur garde son verrou : elle redevient reprenable a sa peremption. Rend
 * le nombre de taches menees a une issue ; leve si l'une a echoue.
 */
const runOrganizationJobs = async (
  organizationId: string,
  handlers: ScheduledJobHandlers,
  now: Date
): Promise<number> => {
  const claimed = await withTenant(organizationId, () =>
    claimDueJobsTxnDao({
      organizationId,
      kinds: Object.keys(handlers),
      now,
      staleBefore: new Date(now.getTime() - SCHEDULED_JOB_LOCK_STALE_MS),
      limit: SCHEDULED_JOBS_BATCH_SIZE,
    })
  )

  let processed = 0
  let failures = 0
  for (const row of claimed) {
    const handler = handlers[row.kind]
    if (!handler) continue
    try {
      const outcome = await handler(toScheduledJob(row), now)
      await withTenant(organizationId, () => writeOutcome(row.id, outcome))
      processed += 1
    } catch (error) {
      failures += 1
      logger.error('[SCHEDULED-JOB] Tache en echec', {
        jobId: row.id,
        kind: row.kind,
        error: error instanceof Error ? error.name : 'unknown',
      })
    }
  }
  if (failures > 0) {
    throw new Error(`${failures} tache(s) en echec`)
  }
  return processed
}

/** Un passage : les taches dues de chaque association (ou d'une seule). */
export const runDueScheduledJobsService = async (
  input: RunDueScheduledJobsInput
): Promise<RunDueScheduledJobsResult> => {
  const parsed = organizationIdSchema.safeParse(input.organizationId)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)

  const organizationIds = parsed.data
    ? [parsed.data]
    : await getAllOrganizationIdsDao()

  let processed = 0
  const failed: string[] = []
  for (const organizationId of organizationIds) {
    try {
      processed += await runOrganizationJobs(
        organizationId,
        input.handlers,
        input.now
      )
    } catch (error) {
      logger.error('[SCHEDULED-JOB] Passage en echec pour une association', {
        organizationId,
        error: error instanceof Error ? error.name : 'unknown',
      })
      failed.push(organizationId)
    }
  }
  return {organizations: organizationIds.length, processed, failed}
}
