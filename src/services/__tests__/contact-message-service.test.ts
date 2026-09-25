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
vi.mock('@/db/repositories/contact-message-repository', () => ({
  countUnreadContactMessagesDao: vi.fn(),
  createContactMessageDao: vi.fn(),
  getContactMessageByIdDao: vi.fn(),
  getContactMessagesPageDao: vi.fn(),
  markContactMessageNotificationFailedDao: vi.fn(),
  setContactMessageReadDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../email-service', () => ({
  sendContactMessageNotificationEmailService: vi.fn(),
}))

import {
  countUnreadContactMessagesDao,
  createContactMessageDao,
  getContactMessageByIdDao,
  getContactMessagesPageDao,
  markContactMessageNotificationFailedDao,
  setContactMessageReadDao,
} from '@/db/repositories/contact-message-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {
  canManageContactMessagesService,
  createContactMessageService,
  getContactMessageService,
  getContactMessagesPageService,
  setContactMessageReadService,
} from '../contact-message-service'
import {sendContactMessageNotificationEmailService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {CONTACT_MESSAGES_BUREAU_PAGE_SIZE} from '../types/domain/contact-message-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

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

const messageRow = (overrides: Record<string, unknown> = {}) => ({
  id: MESSAGE_ID,
  organizationId: ORG_ID,
  senderName: 'Claire Meunier',
  senderEmail: 'claire.meunier@example.fr',
  subject: "Analyse d'eau du forage",
  body: 'Bonjour,\nQuand paraît la prochaine analyse ?',
  read: false,
  notificationFailed: false,
  createdAt: new Date('2026-09-02T12:32:00Z'),
  ...overrides,
})

const submission = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  locale: 'fr',
  name: 'Claire Meunier',
  email: 'claire.meunier@example.fr',
  subject: "Analyse d'eau du forage",
  body: 'Bonjour,\nQuand paraît la prochaine analyse ?',
  ...overrides,
})

const settingsWith = (contactEmail: string) => ({
  'contact.email': {value: contactEmail, isDefault: false},
  'identity.accent_hue': {value: '195', isDefault: true},
})

const readDaos = () => [
  getContactMessagesPageDao,
  getContactMessageByIdDao,
  countUnreadContactMessagesDao,
  setContactMessageReadDao,
]

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(createContactMessageDao).mockResolvedValue(messageRow() as never)
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: "Les Amis de l'Étang",
    domain: 'amis-etang.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    settingsWith('bureau@amis-etang.test') as never
  )
  vi.mocked(sendContactMessageNotificationEmailService).mockResolvedValue()
})

describe('[PUBLIC] createContactMessageService — le visiteur anonyme écrit', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('should write the message under the tenant scope, without any session', async () => {
    let writtenUnder: string | undefined
    vi.mocked(createContactMessageDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return messageRow() as never
    })

    const result = await createContactMessageService(submission())

    expect(result).toEqual({
      status: 'created',
      id: MESSAGE_ID,
      notificationFailed: false,
    })
    expect(writtenUnder).toBe(ORG_ID)
    expect(createContactMessageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      senderName: 'Claire Meunier',
      senderEmail: 'claire.meunier@example.fr',
      subject: "Analyse d'eau du forage",
      body: 'Bonjour,\nQuand paraît la prochaine analyse ?',
    })
  })

  it('should store a missing name as null', async () => {
    await createContactMessageService(submission({name: '   '}))

    expect(createContactMessageDao).toHaveBeenCalledWith(
      expect.objectContaining({senderName: null})
    )
  })

  it('should notify the address read from the tenant settings at send time (criterion 4)', async () => {
    await createContactMessageService(submission())
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith('nouvelle@amis-etang.test') as never
    )
    await createContactMessageService(submission())

    const recipients = vi
      .mocked(sendContactMessageNotificationEmailService)
      .mock.calls.map(([payload]) => payload.to)
    expect(recipients).toEqual([
      'bureau@amis-etang.test',
      'nouvelle@amis-etang.test',
    ])
  })

  it('should pass the explicit locale, the association and the back-office URL', async () => {
    await createContactMessageService(submission())

    expect(sendContactMessageNotificationEmailService).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
        association: expect.objectContaining({
          name: "Les Amis de l'Étang",
          hue: 195,
        }),
        messageUrl: expect.stringMatching(
          new RegExp(
            `//amis-etang\\.test(:\\d+)?/bureau/messages/${MESSAGE_ID}$`
          )
        ),
        message: expect.objectContaining({
          id: MESSAGE_ID,
          senderEmail: 'claire.meunier@example.fr',
        }),
      })
    )
  })

  it('should keep the message and succeed when the transport fails, flagging the failure', async () => {
    let flaggedUnder: string | undefined
    vi.mocked(sendContactMessageNotificationEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus')
    )
    vi.mocked(markContactMessageNotificationFailedDao).mockImplementation(
      async () => {
        flaggedUnder = scope.current
      }
    )

    const result = await createContactMessageService(submission())

    expect(result).toEqual({
      status: 'created',
      id: MESSAGE_ID,
      notificationFailed: true,
    })
    expect(createContactMessageDao).toHaveBeenCalledTimes(1)
    expect(markContactMessageNotificationFailedDao).toHaveBeenCalledWith(
      MESSAGE_ID
    )
    expect(flaggedUnder).toBe(ORG_ID)
    expect(logger.error).toHaveBeenCalled()
  })

  it('should still succeed when flagging the failed notification fails too', async () => {
    vi.mocked(sendContactMessageNotificationEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'refus')
    )
    vi.mocked(markContactMessageNotificationFailedDao).mockRejectedValue(
      new Error('connexion perdue')
    )

    const result = await createContactMessageService(submission())

    expect(result).toEqual({
      status: 'created',
      id: MESSAGE_ID,
      notificationFailed: true,
    })
    expect(logger.error).toHaveBeenCalledTimes(2)
  })

  it('should not flag anything when the notification leaves', async () => {
    await createContactMessageService(submission())

    expect(markContactMessageNotificationFailedDao).not.toHaveBeenCalled()
  })

  it('should NOT read the list', async () => {
    await expect(getContactMessagesPageService(ORG_ID, 1)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT open a message', async () => {
    await expect(getContactMessageService(ORG_ID, MESSAGE_ID)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })
})

describe('createContactMessageService — validation (critère 2)', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it.each([
    ['un email mal formé', {email: 'claire.meunier'}],
    ['un message vide', {body: ''}],
    ['un message fait d espaces', {body: '   \n  '}],
    ['un objet trop court', {subject: 'ab'}],
    ['un message trop long', {body: 'a'.repeat(5001)}],
    ['un nom trop long', {name: 'a'.repeat(121)}],
    ['une association invalide', {organizationId: 'pas-un-uuid'}],
  ])(
    'should reject %s without writing nor sending',
    async (_label, overrides) => {
      await expect(
        createContactMessageService(submission(overrides))
      ).rejects.toThrow()

      expect(createContactMessageDao).not.toHaveBeenCalled()
      expect(sendContactMessageNotificationEmailService).not.toHaveBeenCalled()
    }
  )

  it('should accept a short but non-empty message', async () => {
    await expect(
      createContactMessageService(submission({body: 'Bonjour ?'}))
    ).resolves.toMatchObject({status: 'created'})
  })
})

describe.each([
  ['[ORGANIZATION OWNER]', UserOrganizationRoleConst.OWNER],
  ['[ORGANIZATION ADMIN]', UserOrganizationRoleConst.ADMIN],
])('%s lit et bascule le témoin', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
  })

  it('should read the list in the order the repository gives (created_at desc)', async () => {
    const newer = messageRow({
      id: '44444444-4444-4444-8444-444444444444',
      createdAt: new Date('2026-09-03T08:00:00Z'),
    })
    const older = messageRow()
    let readUnder: string | undefined
    vi.mocked(getContactMessagesPageDao).mockImplementation(async () => {
      readUnder = scope.current
      return {rows: [newer, older], total: 2} as never
    })
    vi.mocked(countUnreadContactMessagesDao).mockResolvedValue(2)

    const list = await getContactMessagesPageService(ORG_ID, 1)

    expect(list.items.map((item) => item.id)).toEqual([newer.id, older.id])
    expect(list).toMatchObject({
      page: 1,
      pageSize: CONTACT_MESSAGES_BUREAU_PAGE_SIZE,
      total: 2,
      totalPages: 1,
      unreadCount: 2,
    })
    expect(readUnder).toBe(ORG_ID)
    expect(getContactMessagesPageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: CONTACT_MESSAGES_BUREAU_PAGE_SIZE,
      offset: 0,
    })
  })

  it('should open a message', async () => {
    vi.mocked(getContactMessageByIdDao).mockResolvedValue(messageRow() as never)

    const message = await getContactMessageService(ORG_ID, MESSAGE_ID)

    expect(message).toMatchObject({
      id: MESSAGE_ID,
      body: 'Bonjour,\nQuand paraît la prochaine analyse ?',
    })
  })

  it('should say not found for a message of another association', async () => {
    vi.mocked(getContactMessageByIdDao).mockResolvedValue(
      messageRow({organizationId: OTHER_ORG_ID}) as never
    )

    await expect(getContactMessageService(ORG_ID, MESSAGE_ID)).rejects.toThrow(
      NotFoundError
    )
  })

  it('should toggle the read flag under the tenant scope', async () => {
    let writtenUnder: string | undefined
    vi.mocked(setContactMessageReadDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return messageRow({read: true}) as never
    })

    const message = await setContactMessageReadService({
      organizationId: ORG_ID,
      messageId: MESSAGE_ID,
      read: true,
    })

    expect(message.read).toBe(true)
    expect(setContactMessageReadDao).toHaveBeenCalledWith(MESSAGE_ID, true)
    expect(writtenUnder).toBe(ORG_ID)
  })

  it('should say not found when there is nothing to toggle', async () => {
    vi.mocked(setContactMessageReadDao).mockResolvedValue(undefined)

    await expect(
      setContactMessageReadService({
        organizationId: ORG_ID,
        messageId: MESSAGE_ID,
        read: false,
      })
    ).rejects.toThrow(NotFoundError)
  })

  it('should be allowed to manage the messages', async () => {
    expect(await canManageContactMessagesService(ORG_ID)).toBe(true)
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
])('%s ne lit rien', (_label, userOf) => {
  beforeEach(() => {
    setupAuthUserMocked(userOf())
  })

  it('should NOT read the list', async () => {
    await expect(getContactMessagesPageService(ORG_ID, 1)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT open a message', async () => {
    await expect(getContactMessageService(ORG_ID, MESSAGE_ID)).rejects.toThrow(
      AuthorizationError
    )
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should NOT toggle the read flag', async () => {
    await expect(
      setContactMessageReadService({
        organizationId: ORG_ID,
        messageId: MESSAGE_ID,
        read: true,
      })
    ).rejects.toThrow(AuthorizationError)
    readDaos().forEach((dao) => expect(dao).not.toHaveBeenCalled())
  })

  it('should not be allowed to manage the messages', async () => {
    expect(await canManageContactMessagesService(ORG_ID)).toBe(false)
  })
})

describe('[SUPER_ADMIN] lit les messages de toute association', () => {
  it('should read the list', async () => {
    setupAuthUserMocked(userTestSuperAdmin as User)
    vi.mocked(getContactMessagesPageDao).mockResolvedValue({
      rows: [],
      total: 0,
    } as never)
    vi.mocked(countUnreadContactMessagesDao).mockResolvedValue(0)

    await expect(
      getContactMessagesPageService(ORG_ID, 1)
    ).resolves.toMatchObject({items: [], totalPages: 1})
  })
})

describe('validation des lectures du bureau', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  })

  it('should refuse a page number below 1', async () => {
    await expect(getContactMessagesPageService(ORG_ID, 0)).rejects.toThrow()
    expect(getContactMessagesPageDao).not.toHaveBeenCalled()
  })

  it('should serve the last page when the requested one is past the end', async () => {
    const last = messageRow()
    vi.mocked(getContactMessagesPageDao).mockImplementation(
      async ({offset}) =>
        (offset === CONTACT_MESSAGES_BUREAU_PAGE_SIZE
          ? {rows: [last], total: CONTACT_MESSAGES_BUREAU_PAGE_SIZE + 1}
          : {rows: [], total: CONTACT_MESSAGES_BUREAU_PAGE_SIZE + 1}) as never
    )
    vi.mocked(countUnreadContactMessagesDao).mockResolvedValue(0)

    const list = await getContactMessagesPageService(ORG_ID, 9)

    expect(list.items.map((item) => item.id)).toEqual([last.id])
    expect(list).toMatchObject({page: 2, totalPages: 2})
  })

  it('should keep an empty first page when there is no message at all', async () => {
    vi.mocked(getContactMessagesPageDao).mockResolvedValue({
      rows: [],
      total: 0,
    } as never)
    vi.mocked(countUnreadContactMessagesDao).mockResolvedValue(0)

    const list = await getContactMessagesPageService(ORG_ID, 3)

    expect(list).toMatchObject({items: [], page: 1, total: 0, totalPages: 1})
  })

  it('should refuse a message id that is not a UUID', async () => {
    await expect(getContactMessageService(ORG_ID, 'abc')).rejects.toThrow()
    expect(getContactMessageByIdDao).not.toHaveBeenCalled()
  })
})
