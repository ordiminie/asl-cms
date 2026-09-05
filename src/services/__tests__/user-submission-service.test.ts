import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/user-submission-repository', () => ({
  createUserSubmissionDao: vi.fn(),
  getUserSubmissionByIdDao: vi.fn(),
  getAllUserSubmissionsWithPaginationDao: vi.fn(),
  markUserSubmissionAsReadDao: vi.fn(),
  archiveUserSubmissionDao: vi.fn(),
  getUnreadSubmissionsCountDao: vi.fn(),
}))

vi.mock('../facades/email-service-facade', () => ({
  sendInternalEmailService: vi.fn(),
}))

import * as userSubmissionRepository from '@/db/repositories/user-submission-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {RoleConst} from '../types/domain/auth-types'
import {UserSubmission} from '../types/domain/user-submission-types'
import {User} from '../types/domain/user-types'
import {
  archiveUserSubmissionService,
  createUserSubmissionService,
  getAllUserSubmissionsService,
  getUnreadSubmissionsCountService,
  getUserSubmissionByIdService,
  markAsReadService,
} from '../user-submission-service'
import {setupAuthUserMocked} from './helper-service-test'

const currentAuthUserId = 'ae760f8e-4aa6-4d71-a4c8-344429b7ae21'
const submissionId = 'fe760f8e-4aa6-4d71-a4c8-344429b7ae29'

const userTest = {
  id: currentAuthUserId,
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  role: RoleConst.USER,
  visibility: 'private',
  banned: null,
  banReason: null,
  banExpires: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  stripeCustomerId: null,
  twoFactorEnabled: null,
} satisfies User

const adminUser = {
  ...userTest,
  role: RoleConst.ADMIN,
} satisfies User

const submissionTest = {
  id: submissionId,
  userId: currentAuthUserId,
  email: null,
  organizationId: null,
  type: 'feedback' as const,
  subject: 'Test Feedback',
  message: 'This is a test feedback message',
  metadata: {},
  read: false,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies UserSubmission

const submissionWithUserTest = {
  ...submissionTest,
  user: {
    id: currentAuthUserId,
    name: 'Test User',
    email: 'test@example.com',
    image: null,
  },
}

describe('[createUserSubmissionService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait créer une soumission si utilisateur connecté', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(
      userSubmissionRepository.createUserSubmissionDao
    ).mockResolvedValue(submissionTest)

    const submissionData = {
      userId: currentAuthUserId,
      type: 'feedback' as const,
      subject: 'Test Feedback',
      message: 'This is a test feedback message',
      metadata: {},
    }

    const result = await createUserSubmissionService(submissionData)
    expect(result).toEqual(submissionTest)
    expect(
      userSubmissionRepository.createUserSubmissionDao
    ).toHaveBeenCalledWith(submissionData)
  })

  it('[USER] devrait créer une soumission de type contact', async () => {
    setupAuthUserMocked(userTest)
    const contactSubmission = {...submissionTest, type: 'contact' as const}
    vi.mocked(
      userSubmissionRepository.createUserSubmissionDao
    ).mockResolvedValue(contactSubmission)

    const submissionData = {
      userId: currentAuthUserId,
      type: 'contact' as const,
      subject: 'Contact Request',
      message: 'I would like to contact you',
      metadata: {},
    }

    const result = await createUserSubmissionService(submissionData)
    expect(result.type).toBe('contact')
  })

  it('[USER] devrait créer une soumission de type support', async () => {
    setupAuthUserMocked(userTest)
    const supportSubmission = {...submissionTest, type: 'support' as const}
    vi.mocked(
      userSubmissionRepository.createUserSubmissionDao
    ).mockResolvedValue(supportSubmission)

    const submissionData = {
      userId: currentAuthUserId,
      type: 'support' as const,
      subject: 'Support Request',
      message: 'I need help with something',
      metadata: {},
    }

    const result = await createUserSubmissionService(submissionData)
    expect(result.type).toBe('support')
  })

  it('[GUEST] devrait lever une erreur si non connecté et sans email', async () => {
    setupAuthUserMocked(undefined)

    const submissionData = {
      type: 'feedback' as const,
      subject: 'Test Feedback',
      message: 'This is a test feedback message',
      metadata: {},
    }

    await expect(createUserSubmissionService(submissionData)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('[GUEST] devrait permettre une soumission anonyme avec email', async () => {
    setupAuthUserMocked(undefined)
    const anonymousSubmission = {
      ...submissionTest,
      userId: null,
      email: 'guest@example.com',
    }
    vi.mocked(
      userSubmissionRepository.createUserSubmissionDao
    ).mockResolvedValue(anonymousSubmission)

    const submissionData = {
      email: 'guest@example.com',
      type: 'feedback' as const,
      subject: 'Test Feedback',
      message: 'This is a test feedback message',
      metadata: {},
    }

    const result = await createUserSubmissionService(submissionData)
    expect(result.email).toBe('guest@example.com')
  })

  it('devrait lever une erreur de validation si sujet vide', async () => {
    setupAuthUserMocked(userTest)

    const invalidData = {
      userId: currentAuthUserId,
      type: 'feedback' as const,
      subject: '',
      message: 'This is a test feedback message',
      metadata: {},
    }

    await expect(createUserSubmissionService(invalidData)).rejects.toThrow(
      ValidationParsedZodError
    )
  })

  it('devrait lever une erreur de validation si message vide', async () => {
    setupAuthUserMocked(userTest)

    const invalidData = {
      userId: currentAuthUserId,
      type: 'feedback' as const,
      subject: 'Test Subject',
      message: '',
      metadata: {},
    }

    await expect(createUserSubmissionService(invalidData)).rejects.toThrow(
      ValidationParsedZodError
    )
  })

  it('devrait lever une erreur de validation si userId invalide', async () => {
    setupAuthUserMocked(userTest)

    const invalidData = {
      userId: 'invalid-uuid',
      type: 'feedback' as const,
      subject: 'Test Subject',
      message: 'Test message',
      metadata: {},
    }

    await expect(createUserSubmissionService(invalidData)).rejects.toThrow(
      ValidationParsedZodError
    )
  })
})

describe('[getAllUserSubmissionsService]', () => {
  const pagination = {limit: 10, offset: 0}

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait récupérer toutes les soumissions', async () => {
    setupAuthUserMocked(adminUser)
    const submissions = [submissionWithUserTest]
    vi.mocked(
      userSubmissionRepository.getAllUserSubmissionsWithPaginationDao
    ).mockResolvedValue({
      data: submissions,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })

    const result = await getAllUserSubmissionsService(pagination)
    expect(result.data).toEqual(submissions)
    expect(
      userSubmissionRepository.getAllUserSubmissionsWithPaginationDao
    ).toHaveBeenCalledWith(pagination, undefined)
  })

  it('[ADMIN] devrait filtrer par type', async () => {
    setupAuthUserMocked(adminUser)
    const submissions = [submissionWithUserTest]
    vi.mocked(
      userSubmissionRepository.getAllUserSubmissionsWithPaginationDao
    ).mockResolvedValue({
      data: submissions,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })

    const filters = {type: 'feedback' as const}
    await getAllUserSubmissionsService(pagination, filters)
    expect(
      userSubmissionRepository.getAllUserSubmissionsWithPaginationDao
    ).toHaveBeenCalledWith(pagination, filters)
  })

  it('[ADMIN] devrait filtrer par statut lu/non-lu', async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(
      userSubmissionRepository.getAllUserSubmissionsWithPaginationDao
    ).mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    })

    const filters = {read: false}
    await getAllUserSubmissionsService(pagination, filters)
    expect(
      userSubmissionRepository.getAllUserSubmissionsWithPaginationDao
    ).toHaveBeenCalledWith(pagination, filters)
  })

  it('[USER] devrait lever une erreur si utilisateur non admin', async () => {
    setupAuthUserMocked(userTest)

    await expect(getAllUserSubmissionsService(pagination)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('[GUEST] devrait lever une erreur si non connecté', async () => {
    setupAuthUserMocked(undefined)

    await expect(getAllUserSubmissionsService(pagination)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('[getUserSubmissionByIdService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait récupérer une soumission par ID', async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(
      userSubmissionRepository.getUserSubmissionByIdDao
    ).mockResolvedValue(submissionWithUserTest)

    const result = await getUserSubmissionByIdService(submissionId)
    expect(result).toEqual(submissionWithUserTest)
    expect(
      userSubmissionRepository.getUserSubmissionByIdDao
    ).toHaveBeenCalledWith(submissionId)
  })

  it('[USER] devrait lever une erreur si utilisateur non admin', async () => {
    setupAuthUserMocked(userTest)

    await expect(getUserSubmissionByIdService(submissionId)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('[markAsReadService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait marquer une soumission comme lue', async () => {
    setupAuthUserMocked(adminUser)
    const readSubmission = {...submissionTest, read: true}
    vi.mocked(
      userSubmissionRepository.markUserSubmissionAsReadDao
    ).mockResolvedValue(readSubmission)

    const result = await markAsReadService(submissionId)
    expect(result?.read).toBe(true)
    expect(
      userSubmissionRepository.markUserSubmissionAsReadDao
    ).toHaveBeenCalledWith(submissionId)
  })

  it('[USER] devrait lever une erreur si utilisateur non admin', async () => {
    setupAuthUserMocked(userTest)

    await expect(markAsReadService(submissionId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('devrait lever une erreur de validation si ID invalide', async () => {
    setupAuthUserMocked(adminUser)

    await expect(markAsReadService('invalid-uuid')).rejects.toThrow(
      ValidationParsedZodError
    )
  })
})

describe('[archiveUserSubmissionService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait archiver une soumission', async () => {
    setupAuthUserMocked(adminUser)
    const archivedSubmission = {...submissionTest, archived: true}
    vi.mocked(
      userSubmissionRepository.archiveUserSubmissionDao
    ).mockResolvedValue(archivedSubmission)

    const result = await archiveUserSubmissionService(submissionId)
    expect(result?.archived).toBe(true)
    expect(
      userSubmissionRepository.archiveUserSubmissionDao
    ).toHaveBeenCalledWith(submissionId)
  })

  it('[USER] devrait lever une erreur si utilisateur non admin', async () => {
    setupAuthUserMocked(userTest)

    await expect(archiveUserSubmissionService(submissionId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('devrait lever une erreur de validation si ID invalide', async () => {
    setupAuthUserMocked(adminUser)

    await expect(archiveUserSubmissionService('invalid-uuid')).rejects.toThrow(
      ValidationParsedZodError
    )
  })
})

describe('[getUnreadSubmissionsCountService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait compter les soumissions non lues', async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(
      userSubmissionRepository.getUnreadSubmissionsCountDao
    ).mockResolvedValue(5)

    const result = await getUnreadSubmissionsCountService()
    expect(result).toBe(5)
    expect(
      userSubmissionRepository.getUnreadSubmissionsCountDao
    ).toHaveBeenCalled()
  })

  it('[USER] devrait retourner 0 si utilisateur non admin', async () => {
    setupAuthUserMocked(userTest)

    const result = await getUnreadSubmissionsCountService()
    expect(result).toBe(0)
  })

  it('[GUEST] devrait retourner 0 si non connecté', async () => {
    setupAuthUserMocked(undefined)

    const result = await getUnreadSubmissionsCountService()
    expect(result).toBe(0)
  })
})
