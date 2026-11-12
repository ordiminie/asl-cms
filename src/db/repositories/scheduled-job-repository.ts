import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'

import {
  AddScheduledJobModel,
  scheduledJob,
  ScheduledJobModel,
} from '@/db/models/scheduled-job-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Planificateur en base (ADR 006, ADR 052). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, aucune tache ne se lit ni ne s'ecrit.
 * Les ecritures s'executent dans la transaction du scope de tenant.
 */

export type EnqueueScheduledJobInput = Pick<
  AddScheduledJobModel,
  'organizationId' | 'kind' | 'idempotencyKey' | 'runAfter' | 'payload'
>

export type ClaimDueJobsInput = {
  organizationId: string
  kinds: string[]
  now: Date
  /** Un verrou pose avant cet instant est perime : la tache est reprenable. */
  staleBefore: Date
  limit: number
}

/**
 * Cree une tache. Une cle deja connue (meme association, meme type) ne cree
 * rien : `undefined`. L'idempotence est portee par la contrainte unique.
 */
export const enqueueScheduledJobTxnDao = async (
  input: EnqueueScheduledJobInput
): Promise<{id: string} | undefined> => {
  const [row] = await getDb()
    .insert(scheduledJob)
    .values(input)
    .onConflictDoNothing({
      target: [
        scheduledJob.organizationId,
        scheduledJob.kind,
        scheduledJob.idempotencyKey,
      ],
    })
    .returning({id: scheduledJob.id})
  return row
}

/**
 * Une tache prise, avec le verrou qu'elle portait avant la prise : non nul,
 * son detenteur precedent est mort ou a echoue sans la rendre (toute issue
 * ecrite leve le verrou), et la tache est une **reprise**.
 */
export type ClaimedScheduledJobModel = ScheduledJobModel & {
  previousLockedAt: Date | null
}

/**
 * Prend les taches dues de l'association : echeance passee, ni closes ni
 * epuisees, sans verrou ou au verrou perime. `FOR UPDATE SKIP LOCKED` : deux
 * passages simultanes ne prennent jamais la meme tache. Le verrou et la
 * tentative sont poses **dans la meme instruction** que la prise ; le verrou
 * precedent est rendu.
 */
export const claimDueJobsTxnDao = async (
  input: ClaimDueJobsInput
): Promise<ClaimedScheduledJobModel[]> => {
  if (input.kinds.length === 0) return []

  const due = getDb()
    .$with('due')
    .as(
      getDb()
        .select({
          id: scheduledJob.id,
          previousLockedAt: sql<Date | null>`${scheduledJob.lockedAt}`.as(
            'previous_locked_at'
          ),
        })
        .from(scheduledJob)
        .where(
          and(
            eq(scheduledJob.organizationId, input.organizationId),
            inArray(scheduledJob.kind, input.kinds),
            lte(scheduledJob.runAfter, input.now),
            isNull(scheduledJob.completedAt),
            isNull(scheduledJob.failedAt),
            or(
              isNull(scheduledJob.lockedAt),
              lt(scheduledJob.lockedAt, input.staleBefore)
            )
          )
        )
        .orderBy(asc(scheduledJob.runAfter), asc(scheduledJob.id))
        .limit(input.limit)
        .for('update', {skipLocked: true})
    )

  const rows = await getDb()
    .with(due)
    .update(scheduledJob)
    .set({
      lockedAt: input.now,
      attempts: sql`${scheduledJob.attempts} + 1`,
      updatedAt: sql`now()`,
    })
    .from(due)
    .where(eq(scheduledJob.id, due.id))
    .returning({
      ...getTableColumns(scheduledJob),
      previousLockedAt: due.previousLockedAt,
    })
  return rows.map((row) => ({
    ...row,
    previousLockedAt:
      row.previousLockedAt === null || row.previousLockedAt === undefined
        ? null
        : new Date(row.previousLockedAt),
  }))
}

/** La tache a abouti : close, verrou leve. */
export const completeJobTxnDao = async (jobId: string): Promise<void> => {
  await getDb()
    .update(scheduledJob)
    .set({lockedAt: null, completedAt: sql`now()`, updatedAt: sql`now()`})
    .where(eq(scheduledJob.id, jobId))
}

/** Nouvelle tentative plus tard : echeance reportee, verrou leve. */
export const rescheduleJobTxnDao = async (
  jobId: string,
  runAfter: Date
): Promise<void> => {
  await getDb()
    .update(scheduledJob)
    .set({lockedAt: null, runAfter, updatedAt: sql`now()`})
    .where(eq(scheduledJob.id, jobId))
}

/** Tentatives epuisees : la tache n'est plus jamais reprise. */
export const failJobTxnDao = async (jobId: string): Promise<void> => {
  await getDb()
    .update(scheduledJob)
    .set({lockedAt: null, failedAt: sql`now()`, updatedAt: sql`now()`})
    .where(eq(scheduledJob.id, jobId))
}

/**
 * Rend la tache sans l'avoir tentee (envois desactives) : verrou leve, la
 * tentative comptee a la prise est rendue.
 */
export const releaseJobTxnDao = async (jobId: string): Promise<void> => {
  await getDb()
    .update(scheduledJob)
    .set({
      lockedAt: null,
      attempts: sql`greatest(${scheduledJob.attempts} - 1, 0)`,
      updatedAt: sql`now()`,
    })
    .where(eq(scheduledJob.id, jobId))
}
