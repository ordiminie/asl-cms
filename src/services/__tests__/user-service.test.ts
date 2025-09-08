import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
  searchUsersDao: vi.fn(),
  createUserSettingsDao: vi.fn(),
  getUserSettingsByUserIdDao: vi.fn(),
  updateUserSettingsByUserIdDao: vi.fn(),
  deleteUserSettingsByUserIdDao: vi.fn(),
  upsertUserSettingsDao: vi.fn(),
}))

vi.mock('@/services/facades/subscription-service-facade', () => ({
  getActivePlansForBetterAuthService: vi.fn(),
}))

import * as userRepository from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {RoleConst} from '../types/domain/auth-types'
import {User, UserSettings} from '../types/domain/user-types'
import {
  createUserSettingsService,
  deleteUserSettingsService,
  getUserByIdService,
  getUserSettingsService,
  searchUsersService,
  updateUserSettingsService,
  upsertUserSettingsService,
} from '../user-service'
import {setupAuthUserMocked} from './helper-service-test'

const currentAuthUserId = 'ae760f8e-4aa6-4d71-a4c8-344429b7ae21' //faker.string.uuid()
const differentUserId = 'de760f8e-4aa6-4d71-a4c8-344429b7ae28' //faker.string.uuid()

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

describe("[getUserById] Lors de l'appel de la fonction", () => {
  const userId = currentAuthUserId
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
  })
  it("[USER] devrait appelé `getUserByIdDao` si l'utilisateur est celui qui est connecté", async () => {
    setupAuthUserMocked(userTest)
    const result = await getUserByIdService(userId)
    expect(result).toEqual(userTest)
    expect(userRepository.getUserByIdDao).toHaveBeenCalledTimes(2)
  })
  it("[USER] devrait levé une erreur si l'utilisateur n'est pas celui connecté et privé", async () => {
    const user = {
      ...userTest,
      id: differentUserId,
    }
    setupAuthUserMocked(user)
    await expect(
      getUserByIdService(currentAuthUserId)
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AuthorizationError: Accès non autorisé.]`
    )
  })
  it("[ADMIN] devrait appelé `getUserByIdDao` si l'utilisateur est un `admin`", async () => {
    const user = {
      ...userTest,
      role: RoleConst.ADMIN,
    } satisfies User
    setupAuthUserMocked(user)
    const result = await getUserByIdService(differentUserId)
    expect(result).toEqual(userTest)
    expect(userRepository.getUserByIdDao).toHaveBeenCalledTimes(2)
  })
  it("[PUBLIC] devrait appelé `getUserByIdDao` si l'utilisateur est `public`", async () => {
    const userPublic = {
      ...userTest,
      id: differentUserId,
      visibility: 'public',
    } satisfies User

    setupAuthUserMocked(undefined)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userPublic)

    const result = await getUserByIdService(differentUserId)
    expect(result).toEqual(userPublic)
    expect(userRepository.getUserByIdDao).toHaveBeenCalledTimes(2)
  })
  it("[PUBLIC] devrait levé une erreur si l'utilisateur est `privé`", async () => {
    const userPrivate = userTest

    setupAuthUserMocked(undefined)
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userPrivate)

    await expect(
      getUserByIdService(differentUserId)
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AuthorizationError: Accès non autorisé.]`
    )
  })
})

describe('[searchUsersService]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait retourner les utilisateurs correspondant au nom', async () => {
    const users = [
      {...userTest, name: 'Alice'},
      {...userTest, name: 'Alicia', email: 'alicia@example.com'},
    ]
    vi.mocked(userRepository.searchUsersDao).mockResolvedValue(users)
    const result = await searchUsersService('Ali')
    expect(result).toEqual(users)
    expect(userRepository.searchUsersDao).toHaveBeenCalledWith('Ali', undefined)
  })

  it("devrait retourner les utilisateurs correspondant à l'email", async () => {
    const users = [{...userTest, email: 'bob@example.com', name: 'Bob'}]
    vi.mocked(userRepository.searchUsersDao).mockResolvedValue(users)
    const result = await searchUsersService('bob@')
    expect(result).toEqual(users)
    expect(userRepository.searchUsersDao).toHaveBeenCalledWith(
      'bob@',
      undefined
    )
  })

  it("devrait exclure les membres d'une organisation", async () => {
    const users = [
      {...userTest, id: '1', name: 'Charlie'},
      {...userTest, id: '2', name: 'Charlotte'},
    ]
    vi.mocked(userRepository.searchUsersDao).mockResolvedValue(users)
    const result = await searchUsersService('Char', 'org-123')
    expect(result).toEqual(users)
    expect(userRepository.searchUsersDao).toHaveBeenCalledWith(
      'Char',
      'org-123'
    )
  })

  it('devrait lever une erreur si le terme est trop court', async () => {
    await expect(searchUsersService('a')).rejects.toThrow(
      'Le terme de recherche doit contenir au moins 2 caractères.'
    )
  })

  it('devrait retourner un tableau vide si aucun résultat', async () => {
    vi.mocked(userRepository.searchUsersDao).mockResolvedValue([])
    const result = await searchUsersService('zzzz')
    expect(result).toEqual([])
  })
})

describe('[UserSettings] CRUD', () => {
  const userId = currentAuthUserId
  const userSettings = {
    userId,
    theme: 'dark' as const,
    language: 'fr' as const,
    timezone: 'Europe/Paris',
    twoFactorType: 'otp',
    enableEmailNotifications: true,
    enablePushNotifications: true,
    notificationChannel: 'both' as const,
    emailDigest: true,
    marketingEmails: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies UserSettings

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('[createUserSettingsService]', () => {
    it('[USER] devrait créer les paramètres pour son propre compte', async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
      vi.mocked(userRepository.createUserSettingsDao).mockResolvedValue(
        userSettings
      )

      const result = await createUserSettingsService(userId, userSettings)
      expect(result).toEqual(userSettings)
      expect(userRepository.createUserSettingsDao).toHaveBeenCalledTimes(1)
    })

    it('[USER] devrait lever une erreur si tentative de création pour un autre utilisateur', async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
        ...userTest,
        id: differentUserId,
      })

      await expect(
        createUserSettingsService(differentUserId, userSettings)
      ).rejects.toThrow(AuthorizationError)
    })
  })

  describe('[getUserSettingsService]', () => {
    it('[USER] devrait récupérer ses propres paramètres', async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
      vi.mocked(userRepository.getUserSettingsByUserIdDao).mockResolvedValue(
        userSettings
      )

      const result = await getUserSettingsService(userId)
      expect(result).toEqual(userSettings)
      expect(userRepository.getUserSettingsByUserIdDao).toHaveBeenCalledWith(
        userId
      )
    })

    it("[USER] devrait lever une erreur si tentative de lecture des paramètres d'un autre utilisateur", async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
        ...userTest,
        id: differentUserId,
      })

      await expect(getUserSettingsService(differentUserId)).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('[updateUserSettingsService]', () => {
    it('[USER] devrait mettre à jour ses propres paramètres', async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
      const updatedSettings = {
        userId,
        theme: 'light' as const,
        language: 'en' as const,
      }

      await updateUserSettingsService(updatedSettings)
      expect(userRepository.upsertUserSettingsDao).toHaveBeenCalledWith(
        userId,
        {
          ...updatedSettings,
          // Zod v4 ajoute automatiquement les valeurs par défaut même avec .partial()
          timezone: 'Europe/Paris',
          enableTwoFactor: false,
          enableEmailNotifications: true,
          enablePushNotifications: true,
          notificationChannel: 'both',
          emailDigest: true,
          marketingEmails: false,
          twoFactorType: 'totp',
        }
      )
    })

    it("[USER] devrait lever une erreur si tentative de mise à jour des paramètres d'un autre utilisateur", async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
        ...userTest,
        id: differentUserId,
      })

      await expect(
        updateUserSettingsService({userId: differentUserId, theme: 'light'})
      ).rejects.toThrow(AuthorizationError)
    })
  })

  describe('[deleteUserSettingsService]', () => {
    it('[USER] devrait supprimer ses propres paramètres', async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
      await deleteUserSettingsService(userId)
      expect(userRepository.deleteUserSettingsByUserIdDao).toHaveBeenCalledWith(
        userId
      )
    })

    it("[USER] devrait lever une erreur si tentative de suppression des paramètres d'un autre utilisateur", async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
        ...userTest,
        id: differentUserId,
      })

      await expect(deleteUserSettingsService(differentUserId)).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('[upsertUserSettingsService]', () => {
    it('[USER] devrait créer ou mettre à jour ses propres paramètres', async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
      vi.mocked(userRepository.upsertUserSettingsDao).mockResolvedValue(
        userSettings
      )

      const result = await upsertUserSettingsService(userSettings)
      expect(result).toEqual(userSettings)
      expect(userRepository.upsertUserSettingsDao).toHaveBeenCalledTimes(1)
    })

    it("[USER] devrait lever une erreur si tentative d'upsert des paramètres d'un autre utilisateur", async () => {
      setupAuthUserMocked(userTest)
      vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
        ...userTest,
        id: differentUserId,
      })

      await expect(
        upsertUserSettingsService({...userSettings, userId: differentUserId})
      ).rejects.toThrow(AuthorizationError)
    })
  })
})
