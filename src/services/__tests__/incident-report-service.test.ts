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
vi.mock('@/db/repositories/incident-report-repository', () => ({
  changeIncidentReportStatusTxnDao: vi.fn(),
  countIncidentReportsByStatusDao: vi.fn(),
  createIncidentReportTxnDao: vi.fn(),
  getIncidentReportByIdDao: vi.fn(),
  getIncidentReportsPageDao: vi.fn(),
  listIncidentReportEventsDao: vi.fn(),
  markIncidentReportNotificationFailedDao: vi.fn(),
}))
vi.mock('@/db/repositories/association-category-repository', () => ({
  listActiveCategoriesDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()]))
})
vi.mock('@/db/repositories/user-repository', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()]))
})
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../email-service', () => ({
  sendIncidentReportNotificationEmailService: vi.fn(),
}))

import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {
  changeIncidentReportStatusTxnDao,
  countIncidentReportsByStatusDao,
  createIncidentReportTxnDao,
  getIncidentReportByIdDao,
  getIncidentReportsPageDao,
  listIncidentReportEventsDao,
  markIncidentReportNotificationFailedDao,
} from '@/db/repositories/incident-report-repository'
import * as organizationRepository from '@/db/repositories/organization-repository'
import * as userRepository from '@/db/repositories/user-repository'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {sendIncidentReportNotificationEmailService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {
  canManageIncidentReportsService,
  changeIncidentReportStatusService,
  createIncidentReportService,
  getIncidentReportService,
  getIncidentReportsPageService,
} from '../incident-report-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {INCIDENT_REPORTS_BUREAU_PAGE_SIZE} from '../types/domain/incident-report-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const REPORT_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const FOREIGN_CATEGORY_ID = '55555555-5555-4555-8555-555555555555'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  name: 'Marie Delorme',
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
  domain: 'report',
  name: "Fuite d'eau",
  routingEmail: null,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  deletedAt: null,
  ...overrides,
})

const reportRow = (overrides: Record<string, unknown> = {}) => ({
  id: REPORT_ID,
  organizationId: ORG_ID,
  categoryId: CATEGORY_ID,
  location: 'Chemin des Pins, devant la parcelle 47',
  description: 'L’eau sort de la chaussée.\nÇa coule fort.',
  reporterName: null,
  reporterEmail: null,
  reporterPhone: null,
  status: 'reported',
  memberId: null,
  notificationFailed: false,
  createdAt: new Date('2026-09-29T05:42:00Z'),
  categoryName: "Fuite d'eau",
  categoryDeletedAt: null,
  ...overrides,
})

const submission = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  locale: 'fr',
  categoryId: CATEGORY_ID,
  location: 'Chemin des Pins, devant la parcelle 47',
  description: 'L’eau sort de la chaussée.\nÇa coule fort.',
  ...overrides,
})

const settingsWith = (contactEmail: string) => ({
  'contact.email': {value: contactEmail, isDefault: false},
  'identity.accent_hue': {value: '195', isDefault: true},
})

const readDaos = () => [
  getIncidentReportsPageDao,
  getIncidentReportByIdDao,
  listIncidentReportEventsDao,
  countIncidentReportsByStatusDao,
]

const writeDaos = () => [
  createIncidentReportTxnDao,
  changeIncidentReportStatusTxnDao,
  markIncidentReportNotificationFailedDao,
]

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(listActiveCategoriesDao).mockResolvedValue([categoryRow()])
  vi.mocked(createIncidentReportTxnDao).mockResolvedValue(reportRow() as never)
  vi.mocked(organizationRepository.getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: "Les Amis de l'Étang",
    domain: 'amis-etang.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    settingsWith('bureau@amis-etang.test') as never
  )
  vi.mocked(sendIncidentReportNotificationEmailService).mockResolvedValue()
  vi.mocked(getIncidentReportByIdDao).mockResolvedValue(reportRow() as never)
  vi.mocked(listIncidentReportEventsDao).mockResolvedValue([])
  vi.mocked(countIncidentReportsByStatusDao).mockResolvedValue({
    reported: 1,
    in_progress: 1,
    resolved: 0,
  })
})

describe('[PUBLIC] createIncidentReportService — le visiteur anonyme signale (critères 1, 2, 8)', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('should write the report with its initial event under the tenant scope, status reported', async () => {
    let writtenUnder: string | undefined
    vi.mocked(createIncidentReportTxnDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return reportRow() as never
    })

    const result = await createIncidentReportService(
      submission({
        name: '  Paul Ferrand ',
        email: 'p.ferrand@example.fr',
        phone: '06 12 34 56 78',
      })
    )

    expect(result).toEqual({
      status: 'created',
      id: REPORT_ID,
      notificationFailed: false,
    })
    expect(writtenUnder).toBe(ORG_ID)
    expect(createIncidentReportTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      categoryId: CATEGORY_ID,
      location: 'Chemin des Pins, devant la parcelle 47',
      description: 'L’eau sort de la chaussée.\nÇa coule fort.',
      reporterName: 'Paul Ferrand',
      reporterEmail: 'p.ferrand@example.fr',
      reporterPhone: '06 12 34 56 78',
    })
  })

  it('should store every missing contact detail as null', async () => {
    await createIncidentReportService(
      submission({name: '   ', email: '', phone: ' '})
    )

    expect(createIncidentReportTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterName: null,
        reporterEmail: null,
        reporterPhone: null,
      })
    )
  })

  it('should never link a member, never look a user or a member up (critère 8)', async () => {
    await createIncidentReportService(
      submission({email: 'membre.seede@example.fr', name: 'Membre Seedé'})
    )

    const [input] = vi.mocked(createIncidentReportTxnDao).mock.calls[0]
    expect(input).not.toHaveProperty('memberId')
    for (const [name, dao] of Object.entries(userRepository)) {
      expect(dao, name).not.toHaveBeenCalled()
    }
    for (const [name, dao] of Object.entries(organizationRepository)) {
      if (name === 'getOrganizationByIdDao') continue
      expect(dao, name).not.toHaveBeenCalled()
    }
  })

  it('should refuse a category that the association does not offer, without writing (décision D)', async () => {
    await expect(
      createIncidentReportService(submission({categoryId: FOREIGN_CATEGORY_ID}))
    ).rejects.toThrow()

    expect(createIncidentReportTxnDao).not.toHaveBeenCalled()
    expect(sendIncidentReportNotificationEmailService).not.toHaveBeenCalled()
  })

  it('should read the offered categories under the tenant scope', async () => {
    let readUnder: string | undefined
    vi.mocked(listActiveCategoriesDao).mockImplementation(async () => {
      readUnder = scope.current
      return [categoryRow()]
    })

    await createIncidentReportService(submission())

    expect(listActiveCategoriesDao).toHaveBeenCalledWith(ORG_ID, 'report')
    expect(readUnder).toBe(ORG_ID)
  })

  it('should require a category when the association offers some', async () => {
    await expect(
      createIncidentReportService(submission({categoryId: undefined}))
    ).rejects.toThrow()

    expect(createIncidentReportTxnDao).not.toHaveBeenCalled()
  })

  it('should accept a report without category when the association offers none (décision D)', async () => {
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([])

    await createIncidentReportService(submission({categoryId: undefined}))

    expect(createIncidentReportTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({categoryId: null})
    )
  })

  it('should keep the report and succeed when the transport fails, flagging the failure', async () => {
    let flaggedUnder: string | undefined
    vi.mocked(sendIncidentReportNotificationEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus')
    )
    vi.mocked(markIncidentReportNotificationFailedDao).mockImplementation(
      async () => {
        flaggedUnder = scope.current
      }
    )

    const result = await createIncidentReportService(submission())

    expect(result).toEqual({
      status: 'created',
      id: REPORT_ID,
      notificationFailed: true,
    })
    expect(createIncidentReportTxnDao).toHaveBeenCalledTimes(1)
    expect(markIncidentReportNotificationFailedDao).toHaveBeenCalledWith(
      REPORT_ID
    )
    expect(flaggedUnder).toBe(ORG_ID)
    expect(logger.error).toHaveBeenCalled()
  })

  it('should still succeed when flagging the failed notification fails too', async () => {
    vi.mocked(sendIncidentReportNotificationEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus')
    )
    vi.mocked(markIncidentReportNotificationFailedDao).mockRejectedValue(
      new Error('connexion perdue')
    )

    await expect(
      createIncidentReportService(submission())
    ).resolves.toMatchObject({status: 'created', notificationFailed: true})
  })

  it('should not flag anything when the notification leaves', async () => {
    await createIncidentReportService(submission())

    expect(markIncidentReportNotificationFailedDao).not.toHaveBeenCalled()
  })

  it('should NOT read the queue nor a report', async () => {
    await expect(getIncidentReportsPageService(ORG_ID, 1)).rejects.toThrow(
      AuthorizationError
    )
    await expect(getIncidentReportService(ORG_ID, REPORT_ID)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT change a status', async () => {
    await expect(
      changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to: 'in_progress',
      })
    ).rejects.toThrow(AuthorizationError)
    expect(changeIncidentReportStatusTxnDao).not.toHaveBeenCalled()
  })
})

describe('createIncidentReportService — validation (décision G)', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it.each([
    ['un lieu vide', {location: '  '}],
    ['un lieu de plus de 200 caractères', {location: 'a'.repeat(201)}],
    ['une description vide', {description: ''}],
    ['une description faite d espaces', {description: '  \n '}],
    ['une description trop longue', {description: 'a'.repeat(2001)}],
    ['un nom trop long', {name: 'a'.repeat(121)}],
    ['un email mal formé', {email: 'p.ferrand@example'}],
    ['un téléphone avec des lettres', {phone: '06 12 AB'}],
    ['un téléphone trop long', {phone: '0'.repeat(31)}],
    ['une catégorie qui n est pas un identifiant', {categoryId: 'fuite'}],
    ['une association invalide', {organizationId: 'pas-un-uuid'}],
  ])(
    'should reject %s without writing nor sending',
    async (_label, overrides) => {
      await expect(
        createIncidentReportService(submission(overrides))
      ).rejects.toThrow()

      expect(createIncidentReportTxnDao).not.toHaveBeenCalled()
      expect(sendIncidentReportNotificationEmailService).not.toHaveBeenCalled()
    }
  )

  it('should accept a phone written with + . - ( ) and spaces', async () => {
    await expect(
      createIncidentReportService(submission({phone: '+33 (0)6.12-34 56 78'}))
    ).resolves.toMatchObject({status: 'created'})
  })
})

describe.each([
  ['[ORGANIZATION OWNER]', UserOrganizationRoleConst.OWNER],
  ['[ORGANIZATION ADMIN]', UserOrganizationRoleConst.ADMIN],
])('%s suit les signalements (critères 2, 3, 5)', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
  })

  it('should read the queue in the repository order, with the counts per status', async () => {
    const newer = reportRow({id: '66666666-6666-4666-8666-666666666666'})
    const deleted = reportRow({
      categoryName: 'Portail',
      categoryDeletedAt: new Date('2026-09-10T00:00:00Z'),
    })
    let readUnder: string | undefined
    vi.mocked(getIncidentReportsPageDao).mockImplementation(async () => {
      readUnder = scope.current
      return {rows: [newer, deleted], total: 2} as never
    })

    const list = await getIncidentReportsPageService(ORG_ID, 1)

    expect(list.items.map((item) => item.id)).toEqual([newer.id, deleted.id])
    expect(list.items[1]).toMatchObject({
      categoryName: 'Portail',
      categoryDeleted: true,
    })
    expect(list.items[0].categoryDeleted).toBe(false)
    expect(list).toMatchObject({
      page: 1,
      pageSize: INCIDENT_REPORTS_BUREAU_PAGE_SIZE,
      total: 2,
      totalPages: 1,
      counts: {reported: 1, in_progress: 1, resolved: 0},
    })
    expect(readUnder).toBe(ORG_ID)
    expect(getIncidentReportsPageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: INCIDENT_REPORTS_BUREAU_PAGE_SIZE,
      offset: 0,
    })
  })

  it('should open a report with its history in order', async () => {
    vi.mocked(listIncidentReportEventsDao).mockResolvedValue([
      {
        id: 'e1',
        status: 'reported',
        authorName: null,
        createdAt: new Date('2026-09-29T05:42:00Z'),
      },
      {
        id: 'e2',
        status: 'in_progress',
        authorName: 'Marie Delorme',
        createdAt: new Date('2026-09-29T07:15:00Z'),
      },
    ] as never)

    const report = await getIncidentReportService(ORG_ID, REPORT_ID)

    expect(report).toMatchObject({
      id: REPORT_ID,
      description: 'L’eau sort de la chaussée.\nÇa coule fort.',
    })
    expect(report.events).toEqual([
      expect.objectContaining({status: 'reported', authorName: null}),
      expect.objectContaining({
        status: 'in_progress',
        authorName: 'Marie Delorme',
      }),
    ])
  })

  it('should say not found for a report of another association', async () => {
    vi.mocked(getIncidentReportByIdDao).mockResolvedValue(
      reportRow({organizationId: OTHER_ORG_ID}) as never
    )

    await expect(getIncidentReportService(ORG_ID, REPORT_ID)).rejects.toThrow(
      NotFoundError
    )
  })

  it.each([
    ['reported', 'in_progress'],
    ['in_progress', 'resolved'],
  ] as const)(
    'should move %s to %s, the event carrying the author (critère 3)',
    async (from, to) => {
      vi.mocked(getIncidentReportByIdDao).mockResolvedValue(
        reportRow({status: from}) as never
      )
      let writtenUnder: string | undefined
      vi.mocked(changeIncidentReportStatusTxnDao).mockImplementation(
        async () => {
          writtenUnder = scope.current
          return reportRow({status: to}) as never
        }
      )

      const result = await changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to,
      })

      expect(result).toEqual({status: 'changed', reportStatus: to})
      expect(changeIncidentReportStatusTxnDao).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        from,
        to,
        authorUserId: userTest.id,
        authorName: 'Marie Delorme',
      })
      expect(writtenUnder).toBe(ORG_ID)
    }
  )

  it.each([
    ['reported', 'resolved'],
    ['in_progress', 'reported'],
    ['resolved', 'reported'],
  ] as const)('should refuse %s → %s without writing', async (from, to) => {
    vi.mocked(getIncidentReportByIdDao).mockResolvedValue(
      reportRow({status: from}) as never
    )

    await expect(
      changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to,
      })
    ).rejects.toThrow()
    expect(changeIncidentReportStatusTxnDao).not.toHaveBeenCalled()
  })

  it.each([
    ['resolved', 'in_progress'],
    ['resolved', 'resolved'],
    ['in_progress', 'in_progress'],
  ] as const)(
    'should answer stale when the report already moved past (%s, asked %s), without writing',
    async (current, to) => {
      vi.mocked(getIncidentReportByIdDao).mockResolvedValue(
        reportRow({status: current}) as never
      )

      const result = await changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to,
      })

      expect(result).toEqual({status: 'stale'})
      expect(changeIncidentReportStatusTxnDao).not.toHaveBeenCalled()
    }
  )

  it('should answer stale when another board member won the race (décision C)', async () => {
    vi.mocked(changeIncidentReportStatusTxnDao).mockResolvedValue(undefined)

    const result = await changeIncidentReportStatusService({
      organizationId: ORG_ID,
      reportId: REPORT_ID,
      to: 'in_progress',
    })

    expect(result).toEqual({status: 'stale'})
  })

  it('should say not found when the report does not exist', async () => {
    vi.mocked(getIncidentReportByIdDao).mockResolvedValue(undefined)

    await expect(
      changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to: 'in_progress',
      })
    ).rejects.toThrow(NotFoundError)
    expect(changeIncidentReportStatusTxnDao).not.toHaveBeenCalled()
  })

  it('should be allowed to manage the reports', async () => {
    expect(await canManageIncidentReportsService(ORG_ID)).toBe(true)
  })
})

describe.each([
  ['[ORGANIZATION MEMBER]', () => withRole(UserOrganizationRoleConst.MEMBER)],
  [
    '[USER NOT IN ORGANIZATION]',
    () => withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
  ],
  ['[USER] sans association', () => userTest as User],
  ['[ADMIN] global sans association', () => userTestAdmin as User],
])('%s ne suit rien', (_label, userOf) => {
  beforeEach(() => {
    setupAuthUserMocked(userOf())
  })

  it('should NOT read the queue', async () => {
    await expect(getIncidentReportsPageService(ORG_ID, 1)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT open a report', async () => {
    await expect(getIncidentReportService(ORG_ID, REPORT_ID)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT change a status', async () => {
    await expect(
      changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to: 'in_progress',
      })
    ).rejects.toThrow(AuthorizationError)
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
    writeDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should not be allowed to manage the reports', async () => {
    expect(await canManageIncidentReportsService(ORG_ID)).toBe(false)
  })
})

describe('validation des lectures du bureau', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  })

  it('should refuse a page number below 1', async () => {
    await expect(getIncidentReportsPageService(ORG_ID, 0)).rejects.toThrow()
    expect(getIncidentReportsPageDao).not.toHaveBeenCalled()
  })

  it('should serve the last page when the requested one is past the end', async () => {
    const last = reportRow()
    vi.mocked(getIncidentReportsPageDao).mockImplementation(
      async ({offset}) =>
        (offset === INCIDENT_REPORTS_BUREAU_PAGE_SIZE
          ? {rows: [last], total: INCIDENT_REPORTS_BUREAU_PAGE_SIZE + 1}
          : {rows: [], total: INCIDENT_REPORTS_BUREAU_PAGE_SIZE + 1}) as never
    )

    const list = await getIncidentReportsPageService(ORG_ID, 9)

    expect(list.items.map((item) => item.id)).toEqual([last.id])
    expect(list).toMatchObject({page: 2, totalPages: 2})
  })

  it('should refuse a report id that is not a UUID', async () => {
    await expect(getIncidentReportService(ORG_ID, 'abc')).rejects.toThrow()
    expect(getIncidentReportByIdDao).not.toHaveBeenCalled()
  })

  it('should refuse an unknown status', async () => {
    await expect(
      changeIncidentReportStatusService({
        organizationId: ORG_ID,
        reportId: REPORT_ID,
        to: 'closed' as never,
      })
    ).rejects.toThrow()
    expect(changeIncidentReportStatusTxnDao).not.toHaveBeenCalled()
  })
})

describe('notification au bureau — destinataires (critères 1, 7 ; décision F)', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  const recipients = () =>
    vi
      .mocked(sendIncidentReportNotificationEmailService)
      .mock.calls.map(([payload]) => payload.to)

  it('should send once to the contact address when the category has no address', async () => {
    await createIncidentReportService(submission())

    expect(recipients()).toEqual(['bureau@amis-etang.test'])
  })

  it('should send to the contact address AND to the category address', async () => {
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([
      categoryRow({routingEmail: 'forage@amis-etang.test'}),
    ])

    await createIncidentReportService(submission())

    expect(recipients()).toEqual([
      'bureau@amis-etang.test',
      'forage@amis-etang.test',
    ])
  })

  it('should send only once when both addresses are the same, whatever the case', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('Contact@amis-etang.test') as never
    )
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([
      categoryRow({routingEmail: 'contact@amis-etang.test'}),
    ])

    await createIncidentReportService(submission())

    expect(recipients()).toEqual(['Contact@amis-etang.test'])
  })

  it('should read the contact address at send time: the next report follows the settings (critère 7)', async () => {
    await createIncidentReportService(submission())
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('nouvelle@amis-etang.test') as never
    )
    await createIncidentReportService(submission())

    expect(recipients()).toEqual([
      'bureau@amis-etang.test',
      'nouvelle@amis-etang.test',
    ])
  })

  it('should flag the report when one send out of two fails, still trying the other', async () => {
    vi.mocked(listActiveCategoriesDao).mockResolvedValue([
      categoryRow({routingEmail: 'forage@amis-etang.test'}),
    ])
    vi.mocked(sendIncidentReportNotificationEmailService).mockImplementation(
      async ({to}) => {
        if (to === 'bureau@amis-etang.test') {
          throw new EmailTransportError('brevo', 'refus')
        }
      }
    )

    const result = await createIncidentReportService(submission())

    expect(result).toMatchObject({status: 'created', notificationFailed: true})
    expect(recipients()).toEqual([
      'bureau@amis-etang.test',
      'forage@amis-etang.test',
    ])
    expect(markIncidentReportNotificationFailedDao).toHaveBeenCalledWith(
      REPORT_ID
    )
  })

  it('should pass the explicit locale, the association, the category and the back-office URL', async () => {
    await createIncidentReportService(submission())

    expect(sendIncidentReportNotificationEmailService).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
        association: expect.objectContaining({
          name: "Les Amis de l'Étang",
          hue: 195,
        }),
        reportUrl: expect.stringMatching(
          new RegExp(
            `//amis-etang\\.test(:\\d+)?/bureau/signalements/${REPORT_ID}$`
          )
        ),
        report: expect.objectContaining({categoryName: "Fuite d'eau"}),
      })
    )
  })
})
