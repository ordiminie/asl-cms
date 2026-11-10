import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/member-note-service-facade', () => ({
  listMemberNotesService: vi.fn(),
}))

import {listMemberNotesService} from '@/services/facades/member-note-service-facade'

import {getMemberNotesForBureauDal} from './member-note-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('member-note-dal (s24)', () => {
  it('lit le fil de la fiche pour le tenant passé, et rien d’autre', async () => {
    const page = {items: [], page: 2, pageSize: 10, total: 11, totalPages: 2}
    vi.mocked(listMemberNotesService).mockResolvedValue(page)

    await expect(
      getMemberNotesForBureauDal(ORG_A, PROFILE_ID, 2)
    ).resolves.toBe(page)
    expect(listMemberNotesService).toHaveBeenCalledTimes(1)
    expect(listMemberNotesService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      memberProfileId: PROFILE_ID,
      page: 2,
    })
  })

  it('laisse remonter un refus d’autorisation', async () => {
    const refusal = new Error('refus')
    vi.mocked(listMemberNotesService).mockRejectedValue(refusal)

    await expect(getMemberNotesForBureauDal(ORG_A, PROFILE_ID, 1)).rejects.toBe(
      refusal
    )
  })
})
