import {getLocale} from 'next-intl/server'

import {grantCreditsTxnDao} from '@/db/repositories/credit-ledger-repository'
import {generateUniqueSlug} from '@/db/repositories/organization-repository'
import {getPlanByCodeDao} from '@/db/repositories/subscription-repository'
import {
  createUserDao,
  createUserRoleAndOrganizationTxnDao,
  createUserSettingsDao,
  deleteUserSettingsByUserIdDao,
  getAllUsersWithPaginationDao,
  getUserByEmailDao,
  getUserByIdDao,
  getUsersByOrganizationDao,
  getUserSettingsByUserIdDao,
  isEmailExistsDao,
  searchUsersDao,
  updateUserSafeByUidDao,
  upsertUserSettingsDao,
} from '@/db/repositories/user-repository'
import {auth} from '@/lib/better-auth/auth'
import {triggerInngestWelcomeFollowUpEmail} from '@/lib/inngest/events'
import {logger} from '@/lib/logger'

import {
  canManageUsers,
  canReadUser,
  canUpdateUser,
} from './authorization/user-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {Pagination, SupportedLanguage} from './types/common-type'
import {RoleConst} from './types/domain/auth-types'
import {CreateOrganization} from './types/domain/organization-types'
import {PlanConst} from './types/domain/subscription-types'
import {
  CreateUser,
  CreateUserFromStripe,
  CreateUserSettings,
  UpdateUser,
  UpdateUserSettings,
} from './types/domain/user-types'
import {
  baseUserServiceSchema,
  createUpdateUserServiceSchema,
  createUserFromStripeServiceSchema,
  createUserServiceSchema,
  createUserSettingsServiceSchema,
  updateUserSettingsServiceSchema,
  userSettingsUuidSchema,
  userUuidSchema,
} from './validation/user-validation'

export const createUserService = async (userParams: CreateUser) => {
  const parsed = createUserServiceSchema.safeParse(userParams)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const userParamsSanitized = parsed.data
  const user = await createUserDao(userParamsSanitized)
  return user
}

export const getUserByIdService = async (id: string) => {
  const parsed = userUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data
  const granted = await canReadUser(parsedUuid)

  if (!granted) {
    throw new AuthorizationError()
  }
  return await getUserByIdDao(parsedUuid)
}

export const getUserByEmailService = async (email: string) => {
  const parsed = baseUserServiceSchema.safeParse({email})
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const emailParamsSanitized = parsed.data.email
  return await getUserByEmailDao(emailParamsSanitized)
}

export const updateUserService = async (userParams: UpdateUser) => {
  const resourceUid = userParams.id
  const granted = await canUpdateUser(resourceUid)

  if (!granted) {
    throw new AuthorizationError()
  }
  userParams.updatedAt = new Date()

  const translatedSchema = await createUpdateUserServiceSchema()
  const parsed = translatedSchema.safeParse(userParams)
  //const parsed = updateUserServiceSchema.safeParse(userParams)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const userParamsSanitized = parsed.data

  await updateUserSafeByUidDao(userParamsSanitized, resourceUid)
}

/**
 * Warn : No Auth
 * Crée une organisation pour un utilisateur
 * @param email
 * @returns
 */
export const createOrganizationForUserService = async (email: string) => {
  if (!email) {
    throw new ValidationError('Email is required')
  }
  const user = await getUserByEmailDao(email)
  if (!user) {
    throw new ValidationError('User not found')
  }
  const slug = await generateUniqueSlug(email.split('@')[0])

  // Créer les données de l'organisation basées sur l'email de l'utilisateur
  const baseName = (user.name || user.email.split('@')[0])
    .toLowerCase()
    .slice(0, 9)
  const organizationData: CreateOrganization = {
    name: `${baseName}'s org`,
    slug,
    description: `Organization for ${user.email}`,
  }

  // Utiliser la fonction transactionnelle avec l'utilisateur existant
  const result = await createUserRoleAndOrganizationTxnDao(
    user.id,
    organizationData
  )

  // Allouer les crédits initiaux du plan FREE
  if (result.organizationId) {
    try {
      const freePlan = await getPlanByCodeDao(PlanConst.FREE)
      const limits = freePlan?.limits as Record<string, number> | null
      const initialCredits = limits?.credits ?? 0

      if (initialCredits > 0) {
        await grantCreditsTxnDao({
          organizationId: result.organizationId,
          amount: initialCredits,
          reason: 'Initial FREE plan allocation',
        })
      }
    } catch (error) {
      logger.error('Failed to allocate initial credits:', error)
    }
  }

  return result
}

/**
 * Recherche des utilisateurs par nom ou email (LIKE/ILIKE),
 * possibilité d'exclure ceux déjà membres d'une organisation.
 */
export const searchUsersService = async (
  query: string,
  excludeOrganizationId?: string
) => {
  if (!query || query.trim().length < 2) {
    throw new ValidationError(
      'Le terme de recherche doit contenir au moins 2 caractères.'
    )
  }
  // Optionnel : on pourrait ajouter une vérification d'autorisation ici
  return await searchUsersDao(query.trim(), excludeOrganizationId)
}

/**
 * Récupère tous les utilisateurs avec pagination pour l'administration
 * Requiert des permissions d'administrateur
 */
export const getAllUsersWithPaginationService = async (
  pagination: Pagination,
  search?: string
) => {
  const granted = await canManageUsers()
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getAllUsersWithPaginationDao(pagination, search)
}

/**
 * Vérifie si un email est disponible pour l'inscription
 */
export const isEmailAvailableService = async (
  email: string
): Promise<boolean> => {
  const exists = await isEmailExistsDao(email)
  return !exists
}

/**
 * Initialise les données utilisateur en vérifiant et créant une organisation si nécessaire
 */
export const initializeRegisterUserDataService = async (
  email: string,
  createUser: boolean = false
) => {
  if (!email) {
    throw new ValidationError('Email is required')
  }

  let user = await getUserByEmailDao(email)

  if (!user && !createUser) {
    throw new ValidationError('User not found')
  }

  if (!user && createUser) {
    await createUserDao({
      email,
      name: email.split('@')[0],
      role: RoleConst.USER,
    })
    user = await getUserByEmailDao(email)
  }

  if (!user) {
    throw new ValidationError('Failed to retrieve user')
  }

  const locale = await getLocale()

  // Créer les settings par défaut si ils n'existent pas
  const existingSettings = await getUserSettingsByUserIdDao(user.id)
  if (!existingSettings) {
    await upsertUserSettingsDao(user.id, {
      userId: user.id,
      language: (locale as 'fr' | 'en' | 'es') || 'fr',
    })
  }

  // Déclencher l'email de suivi 24h après inscription si userId fourni
  if (user.id) {
    try {
      await triggerInngestWelcomeFollowUpEmail({
        userId: user.id,
        userName: user.name || user.email.split('@')[0],
        userEmail: user.email,
        language: locale as SupportedLanguage,
      })
    } catch (error) {
      // Log l'erreur mais ne pas faire échouer l'inscription
      logger.error("Erreur lors du déclenchement de l'email de suivi:", error)
    }
  }

  // Vérifier si l'utilisateur a déjà une organisation
  if (!user.organizations || user.organizations.length === 0) {
    // Créer une organisation pour l'utilisateur
    return await createOrganizationForUserService(email)
  }

  return {
    user,
    organizationId: undefined,
    organizationSlug: undefined,
  }
}

// Services pour les paramètres utilisateur
export const createUserSettingsService = async (
  userId: string,
  settings: CreateUserSettings
) => {
  const parsed = createUserSettingsServiceSchema.safeParse(settings)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const granted = await canUpdateUser(userId)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await createUserSettingsDao({...parsed.data, userId})
}

export const getUserSettingsService = async (userId: string) => {
  const parsed = userSettingsUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const granted = await canReadUser(userId)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getUserSettingsByUserIdDao(userId)
}

export const updateUserSettingsService = async (
  settings: UpdateUserSettings
) => {
  const parsed = updateUserSettingsServiceSchema.safeParse(settings)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const granted = await canUpdateUser(settings.userId)
  if (!granted) {
    throw new AuthorizationError()
  }

  await upsertUserSettingsDao(settings.userId, parsed.data)
}

export const deleteUserSettingsService = async (userId: string) => {
  const parsed = userSettingsUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const granted = await canUpdateUser(userId)
  if (!granted) {
    throw new AuthorizationError()
  }

  await deleteUserSettingsByUserIdDao(userId)
}

export const upsertUserSettingsService = async (
  settings: CreateUserSettings
) => {
  const parsed = createUserSettingsServiceSchema.safeParse(settings)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const granted = await canUpdateUser(settings.userId)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await upsertUserSettingsDao(settings.userId, parsed.data)
}

/**
 * Crée un utilisateur à partir des données Stripe ou retourne l'utilisateur existant
 * Fonction sans autorisation - utilisée par les webhooks Stripe
 */
export const createUserFromStripeService = async (
  userParams: CreateUserFromStripe
) => {
  // Validation des paramètres d'entrée
  const parsed = createUserFromStripeServiceSchema.safeParse(userParams)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const userParamsSanitized = parsed.data

  // Vérifier si l'utilisateur existe déjà
  const existingUser = await getUserByEmailDao(userParamsSanitized.email)

  if (existingUser) {
    // Mettre à jour le stripeCustomerId si fourni et différent
    if (
      userParamsSanitized.stripeCustomerId &&
      existingUser.stripeCustomerId !== userParamsSanitized.stripeCustomerId
    ) {
      await updateUserSafeByUidDao(
        {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          stripeCustomerId: userParamsSanitized.stripeCustomerId,
        },
        existingUser.id
      )

      return {
        user: {
          ...existingUser,
          stripeCustomerId: userParamsSanitized.stripeCustomerId,
        },
        isNewUser: false,
      }
    }

    return {
      user: existingUser,
      isNewUser: false,
    }
  }

  // Créer un nouvel utilisateur avec les données Stripe
  // const newUserData: AddUserModel = {
  //   email: userParamsSanitized.email,
  //   role: RoleConst.USER,
  //   name: userParamsSanitized.name || userParamsSanitized.email.split('@')[0],
  //   stripeCustomerId: userParamsSanitized.stripeCustomerId,
  // }

  //  const newUser: User = await createUserDao(newUserData)

  const response = await auth.api.createUser({
    body: {
      email: userParamsSanitized.email,
      name: userParamsSanitized.name || userParamsSanitized.email.split('@')[0],
      password: '',
      role: ['user'],
    },
  })
  await updateUserSafeByUidDao(
    {
      id: response.user.id ?? '',
      name: userParamsSanitized.name || userParamsSanitized.email.split('@')[0],
      email: userParamsSanitized.email,
      stripeCustomerId: userParamsSanitized.stripeCustomerId,
    },
    response.user.id ?? ''
  )
  await initializeRegisterUserDataService(userParamsSanitized.email)
  await auth.api.sendVerificationEmail({
    body: {
      email: userParamsSanitized.email,
    },
  })

  return {
    user: response,
    isNewUser: true,
  }
}

export const getUsersByOrganizationService = async (organizationId: string) => {
  return await getUsersByOrganizationDao(organizationId)
}
