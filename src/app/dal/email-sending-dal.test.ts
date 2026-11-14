import {readFileSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/email-sending-service-facade', () => ({
  getEmailSendingOverviewService: vi.fn(),
}))

import {getEmailSendingOverviewService} from '@/services/facades/email-sending-service-facade'

import {getEmailSendingOverviewDal} from './email-sending-dal'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-11-14T15:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(NOW)
})

describe('getEmailSendingOverviewDal — envois d’emails du bureau (s52)', () => {
  it('lit les envois de l’association passée, à l’instant de la requête', async () => {
    vi.mocked(getEmailSendingOverviewService).mockResolvedValue({
      limit: 300,
    } as never)

    await expect(getEmailSendingOverviewDal(ORG_ID)).resolves.toEqual({
      limit: 300,
    })
    expect(getEmailSendingOverviewService).toHaveBeenCalledWith(ORG_ID, NOW)
    vi.useRealTimers()
  })

  it('donnée vivante : jamais de cache persistant', () => {
    const source = readFileSync(
      path.join(import.meta.dirname, 'email-sending-dal.ts'),
      'utf8'
    )
    expect(source).not.toMatch(/['"]use cache/)
    expect(source).not.toContain('unstable_cache')
  })
})
