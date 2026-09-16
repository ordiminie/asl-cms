import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  withCurrentTenant: vi.fn(
    async (callback: () => Promise<unknown>) => await callback()
  ),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
}))
vi.mock('@/services/facades/user-submission-service-facade', () => ({
  createUserSubmissionService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getAuthUser} from '@/services/authentication/auth-service'
import {createUserSubmissionService} from '@/services/facades/user-submission-service-facade'

import {createQuickFeedbackAction} from './quick-feedback-action'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue({id: USER_ID} as never)
  vi.mocked(getCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'ASL La Fourche',
    slug: 'asl-la-fourche',
    domain: 'asl-lafourche.fr',
    enabledModules: [],
  })
})

describe('createQuickFeedbackAction', () => {
  it("rattache le retour a l'association servie par le domaine", async () => {
    const result = await createQuickFeedbackAction('Le site est lent')

    expect(result.success).toBe(true)
    expect(createUserSubmissionService).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: TENANT_ID, userId: USER_ID})
    )
  })

  it("n'ecrit rien sur un domaine qui ne sert aucune association", async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const result = await createQuickFeedbackAction('Le site est lent')

    expect(result.success).toBe(false)
    expect(createUserSubmissionService).not.toHaveBeenCalled()
  })
})
