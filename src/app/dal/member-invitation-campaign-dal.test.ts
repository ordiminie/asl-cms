import {readFileSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/member-invitation-campaign-service-facade', () => ({
  getMemberInvitationsOverviewService: vi.fn(),
}))

import {getMemberInvitationsOverviewService} from '@/services/facades/member-invitation-campaign-service-facade'

import {getMemberInvitationsOverviewDal} from './member-invitation-campaign-dal'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMemberInvitationsOverviewDal — la page des invitations (s42b)', () => {
  it('lit la page demandée de l’association passée, par la façade', async () => {
    vi.mocked(getMemberInvitationsOverviewService).mockResolvedValue(
      'page' as never
    )

    await expect(getMemberInvitationsOverviewDal(ORG_ID, 2)).resolves.toBe(
      'page'
    )
    expect(getMemberInvitationsOverviewService).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      page: 2,
    })
  })

  it('donnée par utilisateur : jamais de cache persistant', () => {
    const source = readFileSync(
      path.join(import.meta.dirname, 'member-invitation-campaign-dal.ts'),
      'utf8'
    )
    expect(source).not.toContain("'use cache'")
    expect(source).not.toContain('unstable_cache')
  })
})
