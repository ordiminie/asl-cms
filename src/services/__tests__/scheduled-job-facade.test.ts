import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../scheduled-job-service', () => ({
  runDueScheduledJobsService: vi.fn(async () => ({
    organizations: 0,
    processed: 0,
    failed: [],
  })),
}))
vi.mock('../email-service', () => ({
  emailScheduledJobHandlers: {
    'email.deliver_deferred': vi.fn(),
  },
}))
vi.mock('../pennylane-sync-service', () => ({
  pennylaneSyncScheduledJobHandlers: {
    'billing.sync_pennylane': vi.fn(),
  },
}))
vi.mock('../campaign-service', () => ({
  deliverCampaignPartService: vi.fn(),
  campaignScheduledJobHandlers: {
    'campaign.deliver_part': vi.fn(),
  },
}))

import {campaignScheduledJobHandlers} from '../campaign-service'
import {emailScheduledJobHandlers} from '../email-service'
import * as scheduledJobFacade from '../facades/scheduled-job-service-facade'
import {pennylaneSyncScheduledJobHandlers} from '../pennylane-sync-service'
import {runDueScheduledJobsService} from '../scheduled-job-service'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-11-12T13:32:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('façade du planificateur (s26, ADR 052)', () => {
  it('n’expose que le passage du planificateur', () => {
    expect(Object.keys(scheduledJobFacade)).toEqual([
      'runDueScheduledJobsService',
    ])
  })

  it('compose le registre des gestionnaires à partir du service des campagnes', async () => {
    await scheduledJobFacade.runDueScheduledJobsService(NOW)

    expect(runDueScheduledJobsService).toHaveBeenCalledWith({
      handlers: expect.objectContaining({
        'campaign.deliver_part':
          campaignScheduledJobHandlers['campaign.deliver_part'],
      }),
      now: NOW,
    })
  })

  it('enregistre le rejeu des emails reportés : sans lui, la tâche ne serait jamais prise (s52)', async () => {
    await scheduledJobFacade.runDueScheduledJobsService(NOW)

    expect(runDueScheduledJobsService).toHaveBeenCalledWith(
      expect.objectContaining({
        handlers: expect.objectContaining({
          'email.deliver_deferred':
            emailScheduledJobHandlers['email.deliver_deferred'],
        }),
      })
    )
  })

  it('enregistre la synchronisation Pennylane : sans elle, la tâche horaire ne serait jamais prise (s20)', async () => {
    await scheduledJobFacade.runDueScheduledJobsService(NOW)

    expect(runDueScheduledJobsService).toHaveBeenCalledWith(
      expect.objectContaining({
        handlers: expect.objectContaining({
          'billing.sync_pennylane':
            pennylaneSyncScheduledJobHandlers['billing.sync_pennylane'],
        }),
      })
    )
  })

  it('peut ne passer qu’une association', async () => {
    await scheduledJobFacade.runDueScheduledJobsService(NOW, ORG_ID)

    expect(
      vi.mocked(runDueScheduledJobsService).mock.calls[0][0]
    ).toMatchObject({now: NOW, organizationId: ORG_ID})
  })
})
