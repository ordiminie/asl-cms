import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/notification-repository', () => ({
  createNotificationDao: vi.fn(),
  getNotificationByIdDao: vi.fn(),
  getNotificationsByUserIdDao: vi.fn(),
  getUnreadNotificationsByUserIdDao: vi.fn(),
  countUnreadNotificationsByUserIdDao: vi.fn(),
  markNotificationAsReadDao: vi.fn(),
  markAllNotificationsAsReadDao: vi.fn(),
  updateNotificationDao: vi.fn(),
  deleteNotificationDao: vi.fn(),
  deleteReadNotificationsByUserIdDao: vi.fn(),
}))

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
  getUserSettingsByUserIdDao: vi.fn(),
}))

vi.mock('../email-service', () => ({
  sendNotificationEmailService: vi.fn(),
  sendEmailService: vi.fn(),
}))

vi.mock('../facades/email-service-facade', () => ({
  sendResetPasswordLinkEmailService: vi.fn(),
  sendVerificationEmailService: vi.fn(),
  sendMagicLinkEmailService: vi.fn(),
  sendOTPEmailService: vi.fn(),
  sendNotificationEmailService: vi.fn(),
}))

import * as notificationRepository from '@/db/repositories/notification-repository'
import * as userRepository from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from '../errors/validation-error'
import {
  countUnreadNotificationsByUserIdService,
  createNotificationService,
  createTypedNotificationService,
  deleteNotificationService,
  deleteReadNotificationsByUserIdService,
  getNotificationByIdService,
  getNotificationsByUserIdService,
  getUnreadNotificationsByUserIdService,
  markAllNotificationsAsReadService,
  markNotificationAsReadService,
  updateNotificationService,
} from '../notification-service'
import {RoleConst} from '../types/domain/auth-types'
import {Notification} from '../types/domain/notification-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'

const currentAuthUserId = 'ae760f8e-4aa6-4d71-a4c8-344429b7ae21'
const differentUserId = 'de760f8e-4aa6-4d71-a4c8-344429b7ae28'
const notificationId = 'fe760f8e-4aa6-4d71-a4c8-344429b7ae29'

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

const notificationTest = {
  id: notificationId,
  userId: currentAuthUserId,
  type: 'system',
  title: 'Test Notification',
  message: 'This is a test notification',
  metadata: {},
  read: false,
  createdAt: new Date(),
} satisfies Notification

describe('[createNotificationService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait créer une notification si utilisateur admin', async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
    vi.mocked(userRepository.getUserSettingsByUserIdDao).mockResolvedValue({
      userId: currentAuthUserId,
      enableEmailNotifications: true,
      notificationChannel: 'email',
      language: 'fr',
      enablePushNotifications: true,
      emailDigest: true,
      marketingEmails: false,
      theme: 'system',
      timezone: 'Europe/Paris',
      twoFactorType: 'totp',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(notificationRepository.createNotificationDao).mockResolvedValue(
      notificationTest
    )

    const notificationData = {
      userId: currentAuthUserId,
      type: 'system' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      metadata: {},
    }

    const result = await createNotificationService(notificationData)
    expect(result).toEqual(notificationTest)
    expect(notificationRepository.createNotificationDao).toHaveBeenCalledWith({
      ...notificationData,
      read: false,
    })
    expect(userRepository.getUserByIdDao).toHaveBeenCalledWith(
      currentAuthUserId
    )
  })

  it('[USER] devrait pouvoir créer une notification pour lui-même', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
    vi.mocked(userRepository.getUserSettingsByUserIdDao).mockResolvedValue({
      userId: currentAuthUserId,
      enableEmailNotifications: true,
      notificationChannel: 'both',
      language: 'fr',
      enablePushNotifications: true,
      emailDigest: true,
      marketingEmails: false,
      theme: 'system',
      timezone: 'Europe/Paris',
      twoFactorType: 'totp',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(notificationRepository.createNotificationDao).mockResolvedValue(
      notificationTest
    )

    const notificationData = {
      userId: currentAuthUserId,
      type: 'password_changed' as const,
      title: 'Mot de passe modifié',
      message: 'Votre mot de passe a été modifié avec succès',
      metadata: {},
    }

    const result = await createNotificationService(notificationData)
    expect(result).toEqual(notificationTest)
    expect(notificationRepository.createNotificationDao).toHaveBeenCalledWith({
      ...notificationData,
      read: false,
    })
    expect(userRepository.getUserByIdDao).toHaveBeenCalledWith(
      currentAuthUserId
    )
  })

  it('[USER] devrait créer une notification pour un autre utilisateur (autorisation temporairement désactivée)', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
      ...userTest,
      id: differentUserId,
    })
    vi.mocked(notificationRepository.createNotificationDao).mockResolvedValue({
      ...notificationTest,
      userId: differentUserId,
    })

    const notificationData = {
      userId: differentUserId,
      type: 'system' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      metadata: {},
    }

    const result = await createNotificationService(notificationData)
    expect(result).toEqual({
      ...notificationTest,
      userId: differentUserId,
    })
    expect(notificationRepository.createNotificationDao).toHaveBeenCalledWith({
      ...notificationData,
      read: false,
    })
  })

  it('devrait lever une erreur si utilisateur cible inexistant', async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(undefined)

    const notificationData = {
      userId: currentAuthUserId,
      type: 'system' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      metadata: {},
    }

    await expect(createNotificationService(notificationData)).rejects.toThrow(
      ValidationError
    )
  })

  it('devrait lever une erreur de validation si données invalides', async () => {
    setupAuthUserMocked(adminUser)

    const invalidData = {
      userId: 'invalid-uuid',
      type: 'system' as const,
      title: '',
      message: 'This is a test notification',
      metadata: {},
    }

    await expect(createNotificationService(invalidData)).rejects.toThrow(
      ValidationParsedZodError
    )
  })
})

describe('[createTypedNotificationService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[ADMIN] devrait créer une notification typée', async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
    vi.mocked(userRepository.getUserSettingsByUserIdDao).mockResolvedValue({
      userId: currentAuthUserId,
      enableEmailNotifications: false,
      notificationChannel: 'none',
      language: 'fr',
      enablePushNotifications: false,
      emailDigest: false,
      marketingEmails: false,
      theme: 'system',
      timezone: 'Europe/Paris',
      twoFactorType: 'totp',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(notificationRepository.createNotificationDao).mockResolvedValue(
      notificationTest
    )

    const typedNotificationData = {
      userId: currentAuthUserId,
      type: 'subscription_created' as const,
      title: 'Subscription Created',
      message: 'Your subscription has been created',
      metadata: {
        subscription: {
          id: 'sub-123',
          plan: 'Premium',
          referenceId: currentAuthUserId,
          status: 'active' as const,
        },
      },
    }

    const result = await createTypedNotificationService(typedNotificationData)
    expect(result).toEqual(notificationTest)
    expect(notificationRepository.createNotificationDao).toHaveBeenCalledWith({
      ...typedNotificationData,
      read: false,
    })
  })

  it('[USER] devrait créer une notification typée pour lui-même', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
    vi.mocked(userRepository.getUserSettingsByUserIdDao).mockResolvedValue({
      userId: currentAuthUserId,
      enableEmailNotifications: true,
      notificationChannel: 'email',
      language: 'en',
      enablePushNotifications: false,
      emailDigest: true,
      marketingEmails: false,
      theme: 'dark',
      timezone: 'America/New_York',
      twoFactorType: 'totp',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(notificationRepository.createNotificationDao).mockResolvedValue(
      notificationTest
    )

    const typedNotificationData = {
      userId: currentAuthUserId,
      type: 'password_changed' as const,
      title: 'Mot de passe modifié',
      message: 'Votre mot de passe a été modifié avec succès',
      metadata: {
        changedAt: '2024-01-01T00:00:00Z',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
    }

    const result = await createTypedNotificationService(typedNotificationData)
    expect(result).toEqual(notificationTest)
    expect(notificationRepository.createNotificationDao).toHaveBeenCalledWith({
      ...typedNotificationData,
      read: false,
    })
  })
})

describe('[getNotificationByIdService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait récupérer sa propre notification', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      notificationTest
    )

    const result = await getNotificationByIdService(notificationId)
    expect(result).toEqual(notificationTest)
    expect(notificationRepository.getNotificationByIdDao).toHaveBeenCalledWith(
      notificationId
    )
  })

  it("[USER] devrait lever une erreur si tentative de lecture notification d'un autre utilisateur", async () => {
    const otherUserNotification = {
      ...notificationTest,
      userId: differentUserId,
    }
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      otherUserNotification
    )

    await expect(getNotificationByIdService(notificationId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it("[ADMIN] devrait récupérer n'importe quelle notification", async () => {
    const otherUserNotification = {
      ...notificationTest,
      userId: differentUserId,
    }
    setupAuthUserMocked(adminUser)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      otherUserNotification
    )

    const result = await getNotificationByIdService(notificationId)
    expect(result).toEqual(otherUserNotification)
  })

  it('devrait lever une erreur si ID invalide', async () => {
    setupAuthUserMocked(userTest)

    await expect(getNotificationByIdService('invalid-uuid')).rejects.toThrow(
      ValidationError
    )
  })

  it('devrait lever une erreur si notification inexistante', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      undefined
    )

    await expect(getNotificationByIdService(notificationId)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('[getNotificationsByUserIdService]', () => {
  const pagination = {limit: 10, offset: 0}

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait récupérer ses propres notifications', async () => {
    setupAuthUserMocked(userTest)
    const notifications = [notificationTest]
    vi.mocked(
      notificationRepository.getNotificationsByUserIdDao
    ).mockResolvedValue({
      data: notifications,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })

    const result = await getNotificationsByUserIdService(
      currentAuthUserId,
      pagination
    )
    expect(result.data).toEqual(notifications)
    expect(
      notificationRepository.getNotificationsByUserIdDao
    ).toHaveBeenCalledWith(currentAuthUserId, pagination)
  })

  it("[USER] devrait lever une erreur si tentative de lecture notifications d'un autre utilisateur", async () => {
    setupAuthUserMocked(userTest)

    await expect(
      getNotificationsByUserIdService(differentUserId, pagination)
    ).rejects.toThrow(AuthorizationError)
  })

  it("[ADMIN] devrait récupérer les notifications de n'importe quel utilisateur", async () => {
    setupAuthUserMocked(adminUser)
    const notifications = [notificationTest]
    vi.mocked(
      notificationRepository.getNotificationsByUserIdDao
    ).mockResolvedValue({
      data: notifications,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })

    const result = await getNotificationsByUserIdService(
      differentUserId,
      pagination
    )
    expect(result.data).toEqual(notifications)
  })

  it('devrait lever une erreur si ID utilisateur invalide', async () => {
    setupAuthUserMocked(userTest)

    await expect(
      getNotificationsByUserIdService('invalid-uuid', pagination)
    ).rejects.toThrow(ValidationError)
  })
})

describe('[getUnreadNotificationsByUserIdService]', () => {
  const pagination = {limit: 10, offset: 0}

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait récupérer ses notifications non lues', async () => {
    setupAuthUserMocked(userTest)
    const unreadNotifications = [notificationTest]
    vi.mocked(
      notificationRepository.getUnreadNotificationsByUserIdDao
    ).mockResolvedValue({
      data: unreadNotifications,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })

    const result = await getUnreadNotificationsByUserIdService(
      currentAuthUserId,
      pagination
    )
    expect(result.data).toEqual(unreadNotifications)
    expect(
      notificationRepository.getUnreadNotificationsByUserIdDao
    ).toHaveBeenCalledWith(currentAuthUserId, pagination)
  })

  it("[USER] devrait lever une erreur si tentative de lecture notifications non lues d'un autre utilisateur", async () => {
    setupAuthUserMocked(userTest)

    await expect(
      getUnreadNotificationsByUserIdService(differentUserId, pagination)
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('[countUnreadNotificationsByUserIdService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait compter ses notifications non lues', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(
      notificationRepository.countUnreadNotificationsByUserIdDao
    ).mockResolvedValue(5)

    const result =
      await countUnreadNotificationsByUserIdService(currentAuthUserId)
    expect(result).toBe(5)
    expect(
      notificationRepository.countUnreadNotificationsByUserIdDao
    ).toHaveBeenCalledWith(currentAuthUserId)
  })

  it("[USER] devrait lever une erreur si tentative de comptage notifications d'un autre utilisateur", async () => {
    setupAuthUserMocked(userTest)

    await expect(
      countUnreadNotificationsByUserIdService(differentUserId)
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('[markNotificationAsReadService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait marquer sa notification comme lue', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      notificationTest
    )
    vi.mocked(
      notificationRepository.markNotificationAsReadDao
    ).mockResolvedValue({
      ...notificationTest,
      read: true,
    })

    const result = await markNotificationAsReadService(notificationId)
    expect(result?.read).toBe(true)
    expect(
      notificationRepository.markNotificationAsReadDao
    ).toHaveBeenCalledWith(notificationId)
  })

  it("[USER] devrait lever une erreur si tentative de marquer notification d'un autre utilisateur", async () => {
    const otherUserNotification = {
      ...notificationTest,
      userId: differentUserId,
    }
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      otherUserNotification
    )

    await expect(markNotificationAsReadService(notificationId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('devrait lever une erreur si ID invalide', async () => {
    setupAuthUserMocked(userTest)

    await expect(markNotificationAsReadService('invalid-uuid')).rejects.toThrow(
      ValidationError
    )
  })
})

describe('[markAllNotificationsAsReadService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait marquer toutes ses notifications comme lues', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(
      notificationRepository.markAllNotificationsAsReadDao
    ).mockResolvedValue(3)

    const result = await markAllNotificationsAsReadService(currentAuthUserId)
    expect(result).toBe(3)
    expect(
      notificationRepository.markAllNotificationsAsReadDao
    ).toHaveBeenCalledWith(currentAuthUserId)
  })

  it("[USER] devrait lever une erreur si tentative de marquer notifications d'un autre utilisateur", async () => {
    setupAuthUserMocked(userTest)

    await expect(
      markAllNotificationsAsReadService(differentUserId)
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('[updateNotificationService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait mettre à jour sa notification', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      notificationTest
    )
    const updatedNotification = {
      ...notificationTest,
      read: true,
    }
    vi.mocked(notificationRepository.updateNotificationDao).mockResolvedValue(
      updatedNotification
    )

    const updateData = {
      id: notificationId,
      read: true,
    }

    const result = await updateNotificationService(updateData)
    expect(result).toEqual(updatedNotification)
    expect(notificationRepository.updateNotificationDao).toHaveBeenCalledWith(
      notificationId,
      {
        read: true,
      }
    )
  })

  it("[USER] devrait lever une erreur si tentative de mise à jour notification d'un autre utilisateur", async () => {
    const otherUserNotification = {
      ...notificationTest,
      userId: differentUserId,
    }
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      otherUserNotification
    )

    const updateData = {
      id: notificationId,
      read: true,
    }

    await expect(updateNotificationService(updateData)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('devrait lever une erreur de validation si données invalides', async () => {
    setupAuthUserMocked(userTest)

    const invalidUpdateData = {
      id: 'invalid-uuid',
      read: true,
    }

    await expect(updateNotificationService(invalidUpdateData)).rejects.toThrow(
      ValidationParsedZodError
    )
  })
})

describe('[deleteNotificationService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait supprimer sa notification', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      notificationTest
    )
    vi.mocked(notificationRepository.deleteNotificationDao).mockResolvedValue(
      true
    )

    const result = await deleteNotificationService(notificationId)
    expect(result).toBe(true)
    expect(notificationRepository.deleteNotificationDao).toHaveBeenCalledWith(
      notificationId
    )
  })

  it("[USER] devrait lever une erreur si tentative de suppression notification d'un autre utilisateur", async () => {
    const otherUserNotification = {
      ...notificationTest,
      userId: differentUserId,
    }
    setupAuthUserMocked(userTest)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      otherUserNotification
    )

    await expect(deleteNotificationService(notificationId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it("[ADMIN] devrait supprimer n'importe quelle notification", async () => {
    const otherUserNotification = {
      ...notificationTest,
      userId: differentUserId,
    }
    setupAuthUserMocked(adminUser)
    vi.mocked(notificationRepository.getNotificationByIdDao).mockResolvedValue(
      otherUserNotification
    )
    vi.mocked(notificationRepository.deleteNotificationDao).mockResolvedValue(
      true
    )

    const result = await deleteNotificationService(notificationId)
    expect(result).toBe(true)
  })

  it('devrait lever une erreur si ID invalide', async () => {
    setupAuthUserMocked(userTest)

    await expect(deleteNotificationService('invalid-uuid')).rejects.toThrow(
      ValidationError
    )
  })
})

describe('[deleteReadNotificationsByUserIdService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[USER] devrait supprimer ses notifications lues', async () => {
    setupAuthUserMocked(userTest)
    vi.mocked(
      notificationRepository.deleteReadNotificationsByUserIdDao
    ).mockResolvedValue(2)

    const result =
      await deleteReadNotificationsByUserIdService(currentAuthUserId)
    expect(result).toBe(2)
    expect(
      notificationRepository.deleteReadNotificationsByUserIdDao
    ).toHaveBeenCalledWith(currentAuthUserId)
  })

  it("[USER] devrait lever une erreur si tentative de suppression notifications d'un autre utilisateur", async () => {
    setupAuthUserMocked(userTest)

    await expect(
      deleteReadNotificationsByUserIdService(differentUserId)
    ).rejects.toThrow(AuthorizationError)
  })

  it("[ADMIN] devrait supprimer les notifications lues de n'importe quel utilisateur", async () => {
    setupAuthUserMocked(adminUser)
    vi.mocked(
      notificationRepository.deleteReadNotificationsByUserIdDao
    ).mockResolvedValue(2)

    const result = await deleteReadNotificationsByUserIdService(differentUserId)
    expect(result).toBe(2)
  })

  it('devrait lever une erreur si ID utilisateur invalide', async () => {
    setupAuthUserMocked(userTest)

    await expect(
      deleteReadNotificationsByUserIdService('invalid-uuid')
    ).rejects.toThrow(ValidationError)
  })
})
