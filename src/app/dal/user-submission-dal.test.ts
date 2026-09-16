import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  withCurrentTenant: vi.fn(
    async (callback: () => Promise<unknown>) => await callback()
  ),
}))
vi.mock('@/services/authorization/user-submission-authorization', () => ({
  canManageUserSubmissions: vi.fn(async () => true),
}))
vi.mock('@/services/facades/user-submission-service-facade', () => ({
  getAllUserSubmissionsService: vi.fn(async () => ({data: [], pagination: {}})),
  getUnreadSubmissionsCountService: vi.fn(async () => 0),
  getUserSubmissionByIdService: vi.fn(async () => undefined),
}))

import {withCurrentTenant} from '@/app/dal/tenant-dal'
import {
  getAllUserSubmissionsService,
  getUnreadSubmissionsCountService,
  getUserSubmissionByIdService,
} from '@/services/facades/user-submission-service-facade'

import {
  getAllUserSubmissionsWithPaginationDal,
  getUnreadSubmissionsCountDal,
  getUserSubmissionByIdDal,
} from './user-submission-dal'

beforeEach(() => {
  vi.clearAllMocks()
})

// `user_submissions` porte une policy RLS forcee : hors scope de tenant, ces
// lectures ne rendent rien du tout. Le scope n'est donc pas un detail
// d'implementation, c'est ce qui fait exister le resultat.
describe('lectures de soumissions', () => {
  it('la liste se lit dans le scope du tenant du domaine appele', async () => {
    await getAllUserSubmissionsWithPaginationDal({limit: 10, offset: 0})

    expect(withCurrentTenant).toHaveBeenCalledTimes(1)
    expect(getAllUserSubmissionsService).toHaveBeenCalled()
  })

  it('une soumission se lit dans le scope du tenant', async () => {
    await getUserSubmissionByIdDal('11111111-1111-4111-8111-111111111111')

    expect(withCurrentTenant).toHaveBeenCalledTimes(1)
    expect(getUserSubmissionByIdService).toHaveBeenCalled()
  })

  it('le compteur de non-lues se lit dans le scope du tenant', async () => {
    await getUnreadSubmissionsCountDal()

    expect(withCurrentTenant).toHaveBeenCalledTimes(1)
    expect(getUnreadSubmissionsCountService).toHaveBeenCalled()
  })
})
