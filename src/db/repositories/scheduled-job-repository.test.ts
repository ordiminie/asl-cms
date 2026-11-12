import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO du planificateur (ADR 006, ADR 052). La base n'est pas joignable en
 * unitaire : un client Drizzle `pg-proxy` rend au test chaque requete telle
 * qu'elle partirait vers Postgres. L'atomicite du `SKIP LOCKED` et la RLS se
 * prouvent en e2e.
 */
const {sent, responses} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  responses: {current: [] as unknown[][]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: responses.current.shift() ?? []}
    }),
}))

import {
  claimDueJobsTxnDao,
  completeJobTxnDao,
  enqueueScheduledJobTxnDao,
  failJobTxnDao,
  releaseJobTxnDao,
  rescheduleJobTxnDao,
} from './scheduled-job-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const JOB_ID = '22222222-2222-4222-8222-222222222222'
const PART_ID = '33333333-3333-4333-8333-333333333333'
const NOW = new Date('2026-11-12T13:32:00.000Z')
const STALE_BEFORE = new Date('2026-11-12T13:17:00.000Z')

/** Une ligne `scheduled_job` dans l'ordre des colonnes du modele. */
const jobRow = () => [
  JOB_ID,
  ORG_ID,
  'campaign.deliver_part',
  PART_ID,
  NOW.toISOString(),
  JSON.stringify({partId: PART_ID}),
  1,
  NOW.toISOString(),
  null,
  null,
  NOW.toISOString(),
  NOW.toISOString(),
]

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('enqueueScheduledJobTxnDao — idempotent par la clé unique', () => {
  it('insère la tâche avec ON CONFLICT sur (association, type, clé)', async () => {
    responses.current = [[[JOB_ID]]]

    const created = await enqueueScheduledJobTxnDao({
      organizationId: ORG_ID,
      kind: 'campaign.deliver_part',
      idempotencyKey: PART_ID,
      runAfter: NOW,
      payload: {partId: PART_ID},
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "scheduled_job"/)
    expect(sql).toContain(
      'on conflict ("organization_id","kind","idempotency_key") do nothing'
    )
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'campaign.deliver_part', PART_ID])
    )
    expect(created).toEqual({id: JOB_ID})
  })

  it('une clé déjà connue ne crée rien et rend undefined', async () => {
    await expect(
      enqueueScheduledJobTxnDao({
        organizationId: ORG_ID,
        kind: 'campaign.deliver_part',
        idempotencyKey: PART_ID,
        runAfter: NOW,
        payload: {partId: PART_ID},
      })
    ).resolves.toBeUndefined()
  })
})

describe('claimDueJobsTxnDao — prise des tâches dues', () => {
  const claim = () =>
    claimDueJobsTxnDao({
      organizationId: ORG_ID,
      kinds: ['campaign.deliver_part'],
      now: NOW,
      staleBefore: STALE_BEFORE,
      limit: 20,
    })

  it('pose le verrou et compte la tentative dans la même instruction que la prise', async () => {
    responses.current = [[jobRow()]]

    const jobs = await claim()

    expect(sent).toHaveLength(1)
    const [{sql}] = sent
    expect(sql).toMatch(/\) update "scheduled_job" set /)
    expect(sql).toContain('"locked_at" = $')
    expect(sql).toContain('"attempts" = "scheduled_job"."attempts" + 1')
    expect(sql).toContain('where "scheduled_job"."id" = "due"."id"')
    expect(sql).toContain('for update skip locked')
    expect(sql).toMatch(/returning/)
    expect(jobs).toMatchObject([
      {id: JOB_ID, kind: 'campaign.deliver_part', payload: {partId: PART_ID}},
    ])
  })

  it('ne prend que les tâches dues, ni closes ni échouées, du type demandé, dans l’association', async () => {
    await claim()

    const [{sql, params}] = sent
    expect(sql).toContain('"scheduled_job"."organization_id" = $')
    expect(sql).toContain('"scheduled_job"."kind" in ($')
    expect(sql).toContain('"scheduled_job"."run_after" <= $')
    expect(sql).toContain('"scheduled_job"."completed_at" is null')
    expect(sql).toContain('"scheduled_job"."failed_at" is null')
    expect(sql).toContain('order by "scheduled_job"."run_after"')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'campaign.deliver_part', 20])
    )
  })

  it('rend le verrou précédent : non nul, la tâche est reprise après un détenteur mort (M1)', async () => {
    responses.current = [[[...jobRow(), NOW.toISOString()]]]

    const [job] = await claim()

    const [{sql}] = sent
    expect(sql).toMatch(/^with "due" as \(select /)
    expect(sql).toContain('"locked_at" as "previous_locked_at"')
    expect(sql).toContain('from "due"')
    expect(sql).toContain('"scheduled_job"."id" = "due"."id"')
    expect(job.previousLockedAt).toEqual(NOW)
  })

  it('une première prise rend un verrou précédent nul', async () => {
    responses.current = [[[...jobRow(), null]]]

    const [job] = await claim()

    expect(job.previousLockedAt).toBeNull()
  })

  it('reprend une tâche sans verrou ou au verrou périmé, jamais une tâche tenue', async () => {
    await claim()

    const [{sql, params}] = sent
    expect(sql).toMatch(
      /\("scheduled_job"\."locked_at" is null or "scheduled_job"\."locked_at" < \$\d+\)/
    )
    expect(params).toContain(STALE_BEFORE.toISOString())
  })
})

describe('issues d’une tâche', () => {
  it('completeJobTxnDao clôt la tâche et lève le verrou', async () => {
    await completeJobTxnDao(JOB_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "scheduled_job" set "locked_at" = \$1/)
    expect(sql).toContain('"completed_at" = now()')
    expect(params).toEqual(expect.arrayContaining([null, JOB_ID]))
  })

  it('rescheduleJobTxnDao reporte l’échéance et lève le verrou', async () => {
    const later = new Date('2026-11-12T14:02:00.000Z')

    await rescheduleJobTxnDao(JOB_ID, later)

    const [{sql, params}] = sent
    expect(sql).toContain('"run_after" = $')
    expect(sql).not.toContain('"completed_at"')
    expect(params).toEqual(
      expect.arrayContaining([null, later.toISOString(), JOB_ID])
    )
  })

  it('failJobTxnDao marque la tâche épuisée : elle n’est plus jamais reprise', async () => {
    await failJobTxnDao(JOB_ID)

    const [{sql}] = sent
    expect(sql).toContain('"failed_at" = now()')
    expect(sql).toContain('"locked_at" = $')
  })

  it('releaseJobTxnDao lève le verrou sans compter la tentative', async () => {
    await releaseJobTxnDao(JOB_ID)

    const [{sql}] = sent
    expect(sql).toContain(
      '"attempts" = greatest("scheduled_job"."attempts" - 1, 0)'
    )
    expect(sql).not.toContain('"completed_at"')
    expect(sql).not.toContain('"failed_at"')
  })
})
