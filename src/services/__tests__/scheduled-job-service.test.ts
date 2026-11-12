import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withRlsBypass: vi.fn(),
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getAllOrganizationIdsDao: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
  claimDueJobsTxnDao: vi.fn(),
  completeJobTxnDao: vi.fn(),
  rescheduleJobTxnDao: vi.fn(),
  failJobTxnDao: vi.fn(),
  releaseJobTxnDao: vi.fn(),
}))

import {getAllOrganizationIdsDao} from '@/db/repositories/organization-repository'
import {
  claimDueJobsTxnDao,
  completeJobTxnDao,
  failJobTxnDao,
  releaseJobTxnDao,
  rescheduleJobTxnDao,
} from '@/db/repositories/scheduled-job-repository'
import {withRlsBypass, withTenant} from '@/db/tenant-scope'

import {ValidationParsedZodError} from '../errors/validation-error'
import {runDueScheduledJobsService} from '../scheduled-job-service'
import {
  SCHEDULED_JOB_LOCK_STALE_MS,
  ScheduledJobHandler,
} from '../types/domain/scheduled-job-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const NOW = new Date('2026-11-12T13:32:00.000Z')
const KIND = 'campaign.deliver_part'
const MINUTE = 60 * 1000

const jobRow = (id: string, organizationId = ORG_ID) => ({
  id,
  organizationId,
  kind: KIND,
  idempotencyKey: `part-${id}`,
  runAfter: NOW,
  payload: {partId: `part-${id}`},
  attempts: 1,
  lockedAt: NOW,
  completedAt: null,
  failedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  previousLockedAt: null as Date | null,
})

/** Une file en memoire : une tache prise n'est plus rendue a un autre passage. */
const queueOf = (rows: ReturnType<typeof jobRow>[]) => {
  const waiting = [...rows]
  vi.mocked(claimDueJobsTxnDao).mockImplementation(async ({organizationId}) => {
    const taken = waiting.filter((row) => row.organizationId === organizationId)
    for (const row of taken) waiting.splice(waiting.indexOf(row), 1)
    return taken as never
  })
}

const handler = vi.fn<ScheduledJobHandler>()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAllOrganizationIdsDao).mockResolvedValue([ORG_ID, OTHER_ORG_ID])
  vi.mocked(claimDueJobsTxnDao).mockResolvedValue([])
  handler.mockResolvedValue({status: 'completed'})
})

describe('runDueScheduledJobsService — un passage du planificateur', () => {
  it('prend les tâches de chaque association dans son propre scope, jamais par la porte dérobée', async () => {
    const scopes: (string | undefined)[] = []
    vi.mocked(claimDueJobsTxnDao).mockImplementation(async () => {
      scopes.push(scope.current)
      return []
    })

    await runDueScheduledJobsService({handlers: {[KIND]: handler}, now: NOW})

    expect(scopes).toEqual([ORG_ID, OTHER_ORG_ID])
    expect(withRlsBypass).not.toHaveBeenCalled()
  })

  it('ne prend que les types connus, dus maintenant, au verrou périmé de 15 minutes', async () => {
    await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
      organizationId: ORG_ID,
    })

    expect(SCHEDULED_JOB_LOCK_STALE_MS).toBe(15 * MINUTE)
    expect(claimDueJobsTxnDao).toHaveBeenCalledTimes(1)
    const [input] = vi.mocked(claimDueJobsTxnDao).mock.calls[0]
    expect(input).toMatchObject({
      organizationId: ORG_ID,
      kinds: [KIND],
      now: NOW,
    })
    const lockedAgo = (minutes: number) =>
      new Date(NOW.getTime() - minutes * MINUTE)
    expect(lockedAgo(16) < input.staleBefore).toBe(true)
    expect(lockedAgo(14) < input.staleBefore).toBe(false)
  })

  it('exécute chaque tâche prise hors de la transaction de prise, puis la clôt', async () => {
    queueOf([jobRow('a'), jobRow('b')])
    let claimScopes = 0
    handler.mockImplementation(async () => {
      claimScopes = vi.mocked(withTenant).mock.calls.length
      return {status: 'completed'}
    })

    const result = await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
      organizationId: ORG_ID,
    })

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler.mock.calls[0][0]).toEqual({
      id: 'a',
      organizationId: ORG_ID,
      kind: KIND,
      payload: {partId: 'part-a'},
      attempts: 1,
      resumedAfterStaleLock: false,
    })
    expect(handler.mock.calls[0][1]).toEqual(NOW)
    expect(claimScopes).toBeGreaterThan(0)
    expect(completeJobTxnDao).toHaveBeenCalledWith('a')
    expect(completeJobTxnDao).toHaveBeenCalledWith('b')
    expect(result).toEqual({organizations: 1, processed: 2, failed: []})
  })

  it('signale au gestionnaire une tâche reprise sur un verrou laissé par un détenteur mort (M1)', async () => {
    queueOf([
      {...jobRow('a'), previousLockedAt: new Date(NOW.getTime() - 16 * MINUTE)},
      jobRow('b'),
    ])

    await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
      organizationId: ORG_ID,
    })

    expect(
      handler.mock.calls.map(([job]) => [job.id, job.resumedAfterStaleLock])
    ).toEqual([
      ['a', true],
      ['b', false],
    ])
  })

  it('un gestionnaire qui lève garde le verrou : la prise suivante est une reprise', async () => {
    queueOf([jobRow('a')])
    handler.mockRejectedValueOnce(new Error('inattendu'))

    await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
      organizationId: ORG_ID,
    })

    for (const dao of [
      completeJobTxnDao,
      rescheduleJobTxnDao,
      failJobTxnDao,
      releaseJobTxnDao,
    ]) {
      expect(dao).not.toHaveBeenCalled()
    }
  })

  it('deux passages simultanés ne traitent jamais une tâche deux fois', async () => {
    queueOf([jobRow('a')])

    await Promise.all([
      runDueScheduledJobsService({
        handlers: {[KIND]: handler},
        now: NOW,
        organizationId: ORG_ID,
      }),
      runDueScheduledJobsService({
        handlers: {[KIND]: handler},
        now: NOW,
        organizationId: ORG_ID,
      }),
    ])

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('applique l’issue rendue : reprise plus tard, échec définitif, tâche rendue', async () => {
    const later = new Date(NOW.getTime() + 30 * MINUTE)
    queueOf([jobRow('a'), jobRow('b'), jobRow('c')])
    handler
      .mockResolvedValueOnce({status: 'retry', runAfter: later})
      .mockResolvedValueOnce({status: 'failed'})
      .mockResolvedValueOnce({status: 'released'})

    await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
      organizationId: ORG_ID,
    })

    expect(rescheduleJobTxnDao).toHaveBeenCalledWith('a', later)
    expect(failJobTxnDao).toHaveBeenCalledWith('b')
    expect(releaseJobTxnDao).toHaveBeenCalledWith('c')
    expect(completeJobTxnDao).not.toHaveBeenCalled()
  })

  it('une association en échec n’arrête pas les autres, et elle est nommée', async () => {
    queueOf([jobRow('a', ORG_ID), jobRow('b', OTHER_ORG_ID)])
    handler.mockImplementation(async (job) => {
      if (job.organizationId === ORG_ID) throw new Error('transport')
      return {status: 'completed'}
    })

    const result = await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
    })

    expect(completeJobTxnDao).toHaveBeenCalledWith('b')
    expect(completeJobTxnDao).not.toHaveBeenCalledWith('a')
    expect(result).toEqual({organizations: 2, processed: 1, failed: [ORG_ID]})
  })

  it('une prise impossible dans une association n’arrête pas les autres', async () => {
    vi.mocked(claimDueJobsTxnDao)
      .mockRejectedValueOnce(new Error('base'))
      .mockResolvedValueOnce([jobRow('b', OTHER_ORG_ID)] as never)

    const result = await runDueScheduledJobsService({
      handlers: {[KIND]: handler},
      now: NOW,
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(result.failed).toEqual([ORG_ID])
  })

  it('un identifiant d’association hors forme est refusé avant toute lecture', async () => {
    await expect(
      runDueScheduledJobsService({
        handlers: {[KIND]: handler},
        now: NOW,
        organizationId: 'pas-un-uuid',
      })
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expect(claimDueJobsTxnDao).not.toHaveBeenCalled()
  })
})
