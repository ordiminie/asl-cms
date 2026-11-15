import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/member-question-service-facade', () => ({
  canManageMemberQuestionsService: vi.fn(),
  getMemberQuestionService: vi.fn(),
  getMemberQuestionsPageService: vi.fn(),
  getMyQuestionIdentityService: vi.fn(),
  listMyQuestionCategoriesService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  canManageMemberQuestionsService,
  getMemberQuestionService,
  getMemberQuestionsPageService,
  getMyQuestionIdentityService,
  listMyQuestionCategoriesService,
} from '@/services/facades/member-question-service-facade'

import {
  canManageCurrentMemberQuestionsDal,
  getMemberQuestionForBureauDal,
  getMemberQuestionsForBureauDal,
  getMyQuestionCategoriesDal,
  getMyQuestionIdentityDal,
} from './member-question-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const QUESTION_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('member-question-dal — côté membre (s23)', () => {
  it('lit les sujets ouverts sur l’association du domaine appelé', async () => {
    const categories = [{id: 'c1', name: 'Voirie'}]
    vi.mocked(listMyQuestionCategoriesService).mockResolvedValue(categories)

    await expect(getMyQuestionCategoriesDal()).resolves.toBe(categories)
    expect(listMyQuestionCategoriesService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit l’identité transmise au bureau sur l’association du domaine appelé', async () => {
    const identity = {name: 'Lucie Moreau', email: null}
    vi.mocked(getMyQuestionIdentityService).mockResolvedValue(identity)

    await expect(getMyQuestionIdentityDal()).resolves.toBe(identity)
    expect(getMyQuestionIdentityService).toHaveBeenCalledWith(ORG_A)
  })
})

describe('member-question-dal — côté bureau (s23)', () => {
  it('lit une page de la file pour l’association passée', async () => {
    vi.mocked(getMemberQuestionsPageService).mockResolvedValue({} as never)

    await getMemberQuestionsForBureauDal(ORG_A, 2)

    expect(getMemberQuestionsPageService).toHaveBeenCalledWith(ORG_A, 2)
  })

  it('rend undefined pour une question absente, et laisse remonter un refus', async () => {
    vi.mocked(getMemberQuestionService).mockRejectedValueOnce(
      new NotFoundError('absente')
    )
    await expect(
      getMemberQuestionForBureauDal(ORG_A, QUESTION_ID)
    ).resolves.toBeUndefined()

    vi.mocked(getMemberQuestionService).mockRejectedValueOnce(
      new Error('refus')
    )
    await expect(
      getMemberQuestionForBureauDal(ORG_A, `${QUESTION_ID}x`)
    ).rejects.toThrow('refus')
  })

  it('dit si le compte connecté consulte les questions de l’association du domaine', async () => {
    vi.mocked(canManageMemberQuestionsService).mockResolvedValue(true)

    await expect(canManageCurrentMemberQuestionsDal()).resolves.toBe(true)
    expect(canManageMemberQuestionsService).toHaveBeenCalledWith(ORG_A)
  })
})
