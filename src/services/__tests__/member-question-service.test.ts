import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/member-question-repository', () => ({
  countMemberQuestionsByCategoryDao: vi.fn(),
  createMemberQuestionDao: vi.fn(),
  getMemberQuestionByIdDao: vi.fn(),
  getMemberQuestionsPageDao: vi.fn(),
  markMemberQuestionNotificationFailedDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfilesByUserIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/association-category-repository', () => ({
  listActiveCategoriesDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()]))
})
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../email-service', () => ({
  sendMemberQuestionNotificationEmailService: vi.fn(),
}))

import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {getMemberProfilesByUserIdDao} from '@/db/repositories/member-profile-repository'
import {
  createMemberQuestionDao,
  getMemberQuestionByIdDao,
  getMemberQuestionsPageDao,
  markMemberQuestionNotificationFailedDao,
} from '@/db/repositories/member-question-repository'
import * as organizationRepository from '@/db/repositories/organization-repository'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {sendMemberQuestionNotificationEmailService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {ValidationError} from '../errors/validation-error'
import {
  canManageMemberQuestionsService,
  createMyQuestionService,
  getMemberQuestionService,
  getMemberQuestionsPageService,
  getMyQuestionIdentityService,
  listMyQuestionCategoriesService,
} from '../member-question-service'
import {CategoryDomainConst} from '../types/domain/association-category-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {MEMBER_QUESTIONS_BUREAU_PAGE_SIZE} from '../types/domain/member-question-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const QUESTION_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const FOREIGN_CATEGORY_ID = '55555555-5555-4555-8555-555555555555'
const PROFILE_ID = '66666666-6666-4666-8666-666666666666'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const categoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: CATEGORY_ID,
  organizationId: ORG_ID,
  domain: 'question',
  name: 'Voirie',
  routingEmail: null as string | null,
  createdAt: new Date('2026-11-01T08:00:00Z'),
  deletedAt: null,
  ...overrides,
})

const profileRow = () => ({
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Lucie Moreau',
  email: 'lucie.moreau@exemple.fr',
  phone: '06 12 34 56 78',
  userId: userTest.id,
})

const questionRow = (overrides: Record<string, unknown> = {}) => ({
  id: QUESTION_ID,
  organizationId: ORG_ID,
  memberId: PROFILE_ID,
  categoryId: CATEGORY_ID,
  body: 'Quand le chemin sera-t-il refait ?',
  notificationFailed: false,
  createdAt: new Date('2026-11-14T09:42:00Z'),
  ...overrides,
})

const joinedRow = (overrides: Record<string, unknown> = {}) => ({
  ...questionRow(),
  categoryName: 'Voirie',
  categoryDeletedAt: null,
  memberName: 'Lucie Moreau',
  memberEmail: 'lucie.moreau@exemple.fr',
  ...overrides,
})

const submission = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  locale: 'fr',
  categoryId: CATEGORY_ID,
  body: 'Quand le chemin sera-t-il refait ?',
  ...overrides,
})

const settingsWith = (contactEmail: string | undefined) => ({
  ...(contactEmail
    ? {'contact.email': {value: contactEmail, isDefault: false}}
    : {}),
  'identity.accent_hue': {value: '195', isDefault: true},
})

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(listActiveCategoriesDao).mockResolvedValue([categoryRow()])
  vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
    {...profileRow(), currentParcelNumbers: []},
  ] as never)
  vi.mocked(createMemberQuestionDao).mockResolvedValue(questionRow() as never)
  vi.mocked(organizationRepository.getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: "Les Amis de l'Étang",
    domain: 'amis-etang.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    settingsWith('bureau@amis-etang.test') as never
  )
  vi.mocked(sendMemberQuestionNotificationEmailService).mockResolvedValue({
    status: 'sent',
  })
  vi.mocked(getMemberQuestionsPageDao).mockResolvedValue({
    rows: [joinedRow()],
    total: 1,
  } as never)
  vi.mocked(getMemberQuestionByIdDao).mockResolvedValue(joinedRow() as never)
})

describe('[ORGANIZATION MEMBER] createMyQuestionService — le membre pose sa question (critères 1, 2)', () => {
  beforeEach(() => {
    // s54 : la personne connectee (un proche) n'est pas la titulaire.
    setupAuthUserMocked({
      ...withRole(UserOrganizationRoleConst.MEMBER),
      email: 'claire.moreau@exemple.fr',
    })
  })

  it('should write the question for the session profile, under the tenant scope', async () => {
    let writtenUnder: string | undefined
    vi.mocked(createMemberQuestionDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return questionRow() as never
    })

    const result = await createMyQuestionService(submission())

    expect(result).toEqual({
      status: 'created',
      id: QUESTION_ID,
      notificationFailed: false,
    })
    expect(getMemberProfilesByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      userTest.id
    )
    expect(listActiveCategoriesDao).toHaveBeenCalledWith(
      ORG_ID,
      CategoryDomainConst.QUESTION
    )
    expect(createMemberQuestionDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberId: PROFILE_ID,
      categoryId: CATEGORY_ID,
      body: 'Quand le chemin sera-t-il refait ?',
    })
    expect(writtenUnder).toBe(ORG_ID)
  })

  it('should route to the category address alone when it has one (critère 2)', async () => {
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([
      categoryRow({routingEmail: 'voirie@amis-etang.test'}),
    ])

    await createMyQuestionService(submission())

    expect(sendMemberQuestionNotificationEmailService).toHaveBeenCalledTimes(1)
    expect(sendMemberQuestionNotificationEmailService).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'voirie@amis-etang.test',
        organizationId: ORG_ID,
        questionId: QUESTION_ID,
        questionUrl: expect.stringMatching(
          new RegExp(
            `amis-etang\\.test(:\\d+)?/bureau/questions/${QUESTION_ID}$`
          )
        ),
        question: expect.objectContaining({
          categoryName: 'Voirie',
          memberName: 'Lucie Moreau',
          memberEmail: 'claire.moreau@exemple.fr',
        }),
      })
    )
  })

  it('should route to the contact address when the category has none (critère 2)', async () => {
    await createMyQuestionService(submission())

    expect(sendMemberQuestionNotificationEmailService).toHaveBeenCalledTimes(1)
    expect(sendMemberQuestionNotificationEmailService).toHaveBeenCalledWith(
      expect.objectContaining({to: 'bureau@amis-etang.test'})
    )
  })

  it('should never read an identity from the input', async () => {
    await createMyQuestionService(
      submission({
        name: 'Usurpateur',
        email: 'faux@exemple.fr',
        memberId: '77777777-7777-4777-8777-777777777777',
      })
    )

    expect(createMemberQuestionDao).toHaveBeenCalledWith(
      expect.objectContaining({memberId: PROFILE_ID})
    )
    expect(sendMemberQuestionNotificationEmailService).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({
          memberName: 'Lucie Moreau',
          memberEmail: 'claire.moreau@exemple.fr',
        }),
      })
    )
  })

  it.each([
    ['supprimée', CATEGORY_ID, []],
    ['d’une autre association', FOREIGN_CATEGORY_ID, undefined],
  ])(
    'should refuse a category %s, without writing',
    async (_label, categoryId, offered) => {
      if (offered) vi.mocked(listActiveCategoriesDao).mockResolvedValue(offered)

      await expect(
        createMyQuestionService(submission({categoryId}))
      ).rejects.toThrow(ValidationError)
      expect(createMemberQuestionDao).not.toHaveBeenCalled()
      expect(sendMemberQuestionNotificationEmailService).not.toHaveBeenCalled()
    }
  )

  it('should refuse a question without a category (D2)', async () => {
    await expect(
      createMyQuestionService(submission({categoryId: undefined}))
    ).rejects.toThrow()
    expect(createMemberQuestionDao).not.toHaveBeenCalled()
  })

  it.each([
    ['vide', ''],
    ['faite d espaces', '   '],
    ['de plus de 2 000 caractères', 'a'.repeat(2001)],
  ])('should refuse a question %s, without writing', async (_label, body) => {
    await expect(createMyQuestionService(submission({body}))).rejects.toThrow()
    expect(createMemberQuestionDao).not.toHaveBeenCalled()
  })

  it('should accept a 2 000 characters question', async () => {
    await expect(
      createMyQuestionService(submission({body: 'a'.repeat(2000)}))
    ).resolves.toMatchObject({status: 'created'})
  })

  it('should keep the question when the notification fails: flag set, nothing personal logged', async () => {
    vi.mocked(sendMemberQuestionNotificationEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus')
    )
    let flaggedUnder: string | undefined
    vi.mocked(markMemberQuestionNotificationFailedDao).mockImplementation(
      async () => {
        flaggedUnder = scope.current
      }
    )

    const result = await createMyQuestionService(submission())

    expect(result).toEqual({
      status: 'created',
      id: QUESTION_ID,
      notificationFailed: true,
    })
    expect(markMemberQuestionNotificationFailedDao).toHaveBeenCalledWith(
      QUESTION_ID
    )
    expect(flaggedUnder).toBe(ORG_ID)
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls)
    expect(logged).not.toContain('Quand le chemin')
    expect(logged).not.toContain('lucie.moreau')
    expect(logged).not.toContain('Lucie Moreau')
  })

  it('should flag the question when neither address exists', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith(undefined) as never
    )

    const result = await createMyQuestionService(submission())

    expect(result).toMatchObject({notificationFailed: true})
    expect(sendMemberQuestionNotificationEmailService).not.toHaveBeenCalled()
    expect(markMemberQuestionNotificationFailedDao).toHaveBeenCalledWith(
      QUESTION_ID
    )
  })

  it('should not flag a deferred notification: a deferral is not a failure (s52)', async () => {
    vi.mocked(sendMemberQuestionNotificationEmailService).mockResolvedValue({
      status: 'deferred',
      until: '2026-11-15',
    })

    const result = await createMyQuestionService(submission())

    expect(result).toMatchObject({notificationFailed: false})
    expect(markMemberQuestionNotificationFailedDao).not.toHaveBeenCalled()
  })

  it('should say not_found for an account without a profile, without writing', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    await expect(createMyQuestionService(submission())).resolves.toEqual({
      status: 'not_found',
    })
    expect(createMemberQuestionDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] createMyQuestionService — le visiteur sans compte', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('should refuse a guest, without reading a profile nor writing', async () => {
    await expect(createMyQuestionService(submission())).rejects.toThrow(
      AuthorizationError
    )
    expect(getMemberProfilesByUserIdDao).not.toHaveBeenCalled()
    expect(createMemberQuestionDao).not.toHaveBeenCalled()
  })

  it('should refuse the member reads too', async () => {
    await expect(listMyQuestionCategoriesService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    await expect(getMyQuestionIdentityService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('[SUPER_ADMIN] createMyQuestionService — sans fiche dans l’association', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])
  })

  it('should say not_found, without writing', async () => {
    await expect(createMyQuestionService(submission())).resolves.toEqual({
      status: 'not_found',
    })
    expect(createMemberQuestionDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION MEMBER] lectures du membre — sujets et identité', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
  })

  it('should list the open subjects, id and name only — never the address', async () => {
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([
      categoryRow({routingEmail: 'voirie@amis-etang.test'}),
    ])

    const categories = await listMyQuestionCategoriesService(ORG_ID)

    expect(categories).toEqual([{id: CATEGORY_ID, name: 'Voirie'}])
    expect(listActiveCategoriesDao).toHaveBeenCalledWith(
      ORG_ID,
      CategoryDomainConst.QUESTION
    )
  })

  it('should read the identity the board will receive: the fiche’s name, the address of the person signed in (s54)', async () => {
    setupAuthUserMocked({
      ...withRole(UserOrganizationRoleConst.MEMBER),
      email: 'claire.moreau@exemple.fr',
    })

    await expect(getMyQuestionIdentityService(ORG_ID)).resolves.toEqual({
      name: 'Lucie Moreau',
      email: 'claire.moreau@exemple.fr',
    })
  })

  it('should read nothing for an account without a profile', async () => {
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])

    await expect(listMyQuestionCategoriesService(ORG_ID)).resolves.toBe(
      undefined
    )
    await expect(getMyQuestionIdentityService(ORG_ID)).resolves.toBe(undefined)
  })
})

describe.each([
  ['[ORGANIZATION OWNER]', () => withRole(UserOrganizationRoleConst.OWNER)],
  ['[ORGANIZATION ADMIN]', () => withRole(UserOrganizationRoleConst.ADMIN)],
  ['[SUPER_ADMIN]', () => userTestSuperAdmin],
])('%s consulte les questions reçues (critères 4, 5)', (_label, userOf) => {
  beforeEach(() => {
    setupAuthUserMocked(userOf())
  })

  it('should read a page of the queue, member identity and subject joined', async () => {
    let readUnder: string | undefined
    vi.mocked(getMemberQuestionsPageDao).mockImplementation(async () => {
      readUnder = scope.current
      return {rows: [joinedRow()], total: 1} as never
    })

    const page = await getMemberQuestionsPageService(ORG_ID, 1)

    expect(getMemberQuestionsPageDao).toHaveBeenCalledWith(
      ORG_ID,
      1,
      MEMBER_QUESTIONS_BUREAU_PAGE_SIZE
    )
    expect(readUnder).toBe(ORG_ID)
    expect(page).toMatchObject({
      page: 1,
      pageSize: MEMBER_QUESTIONS_BUREAU_PAGE_SIZE,
      total: 1,
      totalPages: 1,
      hasOpenCategories: true,
    })
    expect(page.items).toEqual([
      {
        id: QUESTION_ID,
        memberId: PROFILE_ID,
        memberName: 'Lucie Moreau',
        memberEmail: 'lucie.moreau@exemple.fr',
        categoryName: 'Voirie',
        categoryDeleted: false,
        body: 'Quand le chemin sera-t-il refait ?',
        notificationFailed: false,
        createdAt: new Date('2026-11-14T09:42:00Z'),
      },
    ])
  })

  it('should say there is no open subject yet', async () => {
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([])
    vi.mocked(getMemberQuestionsPageDao).mockResolvedValue({
      rows: [],
      total: 0,
    } as never)

    const page = await getMemberQuestionsPageService(ORG_ID, 1)

    expect(page.hasOpenCategories).toBe(false)
    expect(page.items).toEqual([])
  })

  it('should fall back to the last page when the page asked is beyond', async () => {
    vi.mocked(getMemberQuestionsPageDao)
      .mockResolvedValueOnce({rows: [], total: 1} as never)
      .mockResolvedValueOnce({rows: [joinedRow()], total: 1} as never)

    const page = await getMemberQuestionsPageService(ORG_ID, 4)

    expect(page.page).toBe(1)
    expect(page.items).toHaveLength(1)
    expect(getMemberQuestionsPageDao).toHaveBeenLastCalledWith(
      ORG_ID,
      1,
      MEMBER_QUESTIONS_BUREAU_PAGE_SIZE
    )
  })

  it('should read a question whose subject was deleted, with its marker (critère 5)', async () => {
    vi.mocked(getMemberQuestionByIdDao).mockResolvedValue(
      joinedRow({categoryDeletedAt: new Date('2026-11-14T12:00:00Z')}) as never
    )

    const question = await getMemberQuestionService(ORG_ID, QUESTION_ID)

    expect(question).toMatchObject({
      id: QUESTION_ID,
      categoryName: 'Voirie',
      categoryDeleted: true,
      memberName: 'Lucie Moreau',
      body: 'Quand le chemin sera-t-il refait ?',
    })
  })

  it('should say not found for a missing question, or one of another tenant', async () => {
    vi.mocked(getMemberQuestionByIdDao).mockResolvedValueOnce(undefined)
    await expect(getMemberQuestionService(ORG_ID, QUESTION_ID)).rejects.toThrow(
      NotFoundError
    )

    vi.mocked(getMemberQuestionByIdDao).mockResolvedValueOnce(
      joinedRow({organizationId: OTHER_ORG_ID}) as never
    )
    await expect(getMemberQuestionService(ORG_ID, QUESTION_ID)).rejects.toThrow(
      NotFoundError
    )
  })

  it('should say the user can manage the questions', async () => {
    await expect(canManageMemberQuestionsService(ORG_ID)).resolves.toBe(true)
  })
})

describe.each([
  ['[ORGANIZATION MEMBER]', () => withRole(UserOrganizationRoleConst.MEMBER)],
  [
    '[USER NOT IN ORGANIZATION]',
    () => withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
  ],
  ['[PUBLIC]', () => undefined],
])('%s ne lit pas les questions reçues', (_label, userOf) => {
  beforeEach(() => {
    setupAuthUserMocked(userOf())
  })

  it('should NOT read the queue nor a question', async () => {
    await expect(getMemberQuestionsPageService(ORG_ID, 1)).rejects.toThrow(
      AuthorizationError
    )
    await expect(getMemberQuestionService(ORG_ID, QUESTION_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getMemberQuestionsPageDao).not.toHaveBeenCalled()
    expect(getMemberQuestionByIdDao).not.toHaveBeenCalled()
  })

  it('should say the user cannot manage the questions', async () => {
    await expect(canManageMemberQuestionsService(ORG_ID)).resolves.toBe(false)
  })
})

describe('[ORGANIZATION MEMBER] question d’un compte à deux fiches (s53)', () => {
  it('rattache la question à la première fiche du compte', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
    vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([
      {
        ...profileRow(),
        id: '99999999-9999-4999-8999-999999999999',
        currentParcelNumbers: [],
      },
      {...profileRow(), currentParcelNumbers: ['12']},
    ] as never)

    await createMyQuestionService(submission())

    expect(createMemberQuestionDao).toHaveBeenCalledWith(
      expect.objectContaining({memberId: profileRow().id})
    )
  })
})
