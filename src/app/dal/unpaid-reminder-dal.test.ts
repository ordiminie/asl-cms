import {readFileSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/unpaid-reminder-service-facade', () => ({
  getUnpaidRemindersOverviewService: vi.fn(),
}))

import {getUnpaidRemindersOverviewService} from '@/services/facades/unpaid-reminder-service-facade'

import {getUnpaidRemindersOverviewDal} from './unpaid-reminder-dal'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUnpaidRemindersOverviewDal — suivi des relances (s29)', () => {
  it('lit la page demandée de l’association passée', async () => {
    vi.mocked(getUnpaidRemindersOverviewService).mockResolvedValue({
      status: 'unavailable',
      enabled: false,
      delaysWeeks: null,
    })

    await expect(getUnpaidRemindersOverviewDal(ORG_ID, 2)).resolves.toEqual({
      status: 'unavailable',
      enabled: false,
      delaysWeeks: null,
    })
    expect(getUnpaidRemindersOverviewService).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      page: 2,
    })
  })

  it('donnée par utilisateur : jamais de cache persistant', () => {
    const source = readFileSync(
      path.join(import.meta.dirname, 'unpaid-reminder-dal.ts'),
      'utf8'
    )
    expect(source).not.toContain("'use cache'")
    expect(source).not.toContain('unstable_cache')
  })
})
