import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../scheduled-job-service', () => ({
  runDueScheduledJobsService: vi.fn(async () => ({
    organizations: 0,
    processed: 0,
    failed: [],
  })),
}))
vi.mock('../campaign-service', () => ({
  deliverCampaignPartService: vi.fn(),
  campaignScheduledJobHandlers: {
    'campaign.deliver_part': vi.fn(),
  },
}))

import {campaignScheduledJobHandlers} from '../campaign-service'
import * as scheduledJobFacade from '../facades/scheduled-job-service-facade'
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

  it('peut ne passer qu’une association', async () => {
    await scheduledJobFacade.runDueScheduledJobsService(NOW, ORG_ID)

    expect(
      vi.mocked(runDueScheduledJobsService).mock.calls[0][0]
    ).toMatchObject({now: NOW, organizationId: ORG_ID})
  })
})
