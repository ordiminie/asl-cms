/* eslint-disable @typescript-eslint/no-explicit-any */
import {and, eq, isNotNull, or, sql} from 'drizzle-orm'

import {
  account,
  member,
  organization,
  session,
  user as users,
} from '@/db/models/auth-model'
import db from '@/db/models/db'
import {AddOrganizationModel} from '@/db/models/organization-model'
import {
  AddUserModel,
  AddUserSettingsModel,
  UpdateUserModel,
  UpdateUserSettingsModel,
  UserModel,
  userSettings,
  UserSettingsModel,
} from '@/db/models/user-model'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'
import {User} from '@/services/types/domain/user-types'

export type SessionModel = typeof session.$inferSelect
export type AddSessionModel = typeof session.$inferInsert
export type UpdateSessionModel = typeof session.$inferInsert

// CRUD
export const createUserDao = async (user: AddUserModel) => {
  const row = await db
    .insert(users)
    .values({email: user.email, name: user.name})
    .returning()
  return row[0]
}

export const getUserByIdDao = async (
  uid: string
): Promise<User | undefined> => {
  const row = await db.query.user.findFirst({
    where: (user, {eq}) => eq(user.id, uid),
    with: {
      members: {
        with: {
          organization: true,
        },
      },
      settings: true,
      notifications: true,
    },
  })

  const organizations = row?.members ?? []

  if (!row) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {members, ...rest} = row
  return {
    ...rest,
    organizations,
  }
}

export const deleteUserByIdDao = async (uid: string) => {
  await db.delete(users).where(eq(users.id, uid))
}

// Extra
export const getUserByEmailDao = async (
  email: string
): Promise<User | undefined> => {
  const row = await db.query.user.findFirst({
    where: (user, {eq}) => eq(user.email, email.toLowerCase()),
    with: {
      members: {
        with: {
          organization: true,
        },
      },
      settings: true,
    },
  })

  const organizations = row?.members ?? []

  if (!row) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {members, ...rest} = row
  return {
    ...rest,
    organizations,
  }
}

export const getUserByStripeCustomerIdDao = async (
  stripeCustomerId: string
): Promise<User | undefined> => {
  const row = await db.query.user.findFirst({
    where: (user, {eq}) => eq(user.stripeCustomerId, stripeCustomerId),
    with: {
      members: {
        with: {
          organization: true,
        },
      },
      settings: true,
    },
  })

  const organizations = row?.members ?? []

  if (!row) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {members, ...rest} = row
  return {
    ...rest,
    organizations,
  }
}

export const getAllUsersWithPaginationDao = async (
  pagination: Pagination,
  search?: string
): Promise<PaginatedResponse<User>> => {
  // Construire la clause WHERE pour la recherche
  let searchCondition: any = undefined
  if (search && search.trim()) {
    const searchTerm = search.trim()
    searchCondition = or(
      sql`${users.name} ILIKE ${`%${searchTerm}%`}`,
      sql`${users.email} ILIKE ${`%${searchTerm}%`}`
    )
  }

  // Récupérer les utilisateurs de base
  const [baseUsers, [{count}]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(searchCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(sql`${users.createdAt} DESC`),
    db
      .select({count: sql<number>`count(*)`})
      .from(users)
      .where(searchCondition),
  ])

  // Transformer en User avec rôles et organisations (simplifié pour l'admin)
  const transformedUsers: User[] = baseUsers.map((user) => ({
    ...user,
    roles: [], // Les rôles seront chargés à la demande si nécessaire
    organizations: [], // Les organisations seront chargées à la demande si nécessaire
  }))

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: transformedUsers,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const updateUserSafeByUidDao = async (
  user: UpdateUserModel,
  uid: string
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {id, email, emailVerified, createdAt, ...rest} = user
  rest.updatedAt = new Date()
  await db
    .update(users)
    .set({...rest})
    .where(eq(users.id, uid))
}

export const createUserRoleAndOrganizationTxnDao = async (
  userId: string,
  organizationData: AddOrganizationModel
): Promise<{user: User; organizationId: string; organizationSlug: string}> => {
  return await db.transaction(async (tx) => {
    // 1. Récupérer l'utilisateur existant
    const existingUser = await tx.query.user.findFirst({
      where: eq(users.id, userId),
    })

    if (!existingUser) {
      throw new Error('User not found')
    }

    // 4. Créer l'organisation
    const [newOrganization] = await tx
      .insert(organization)
      .values({
        name: organizationData.name,
        slug: organizationData.slug,
        description: organizationData.description,
        logo: organizationData.logo,
      })
      .returning()

    // 5. Créer la relation user-organization avec le rôle OWNER
    await tx.insert(member).values({
      userId: existingUser.id,
      organizationId: newOrganization.id,
      role: UserOrganizationRoleConst.OWNER,
      createdAt: new Date(),
    })

    // 4. Retourner les données créées

    return {
      user: {
        ...existingUser,
        organizations: [],
      },
      organizationId: newOrganization.id,
      organizationSlug: newOrganization.slug ?? '',
    }
  })
}

/**
 * Recherche des utilisateurs par nom ou email (LIKE/ILIKE),
 * possibilité d'exclure ceux déjà membres d'une organisation.
 */
export const searchUsersDao = async (
  query: string,
  excludeOrganizationId?: string
): Promise<UserModel[]> => {
  let whereClause: any
  if (excludeOrganizationId) {
    const userOrgs = await db
      .select({userId: member.userId})
      .from(member)
      .where(eq(member.organizationId, excludeOrganizationId))
    const excludedUserIds = userOrgs.map((uo) => uo.userId)

    whereClause = (
      fields: typeof users._.columns,
      {ilike, or, notInArray, and}: any
    ) =>
      and(
        or(ilike(fields.name, `%${query}%`), ilike(fields.email, `%${query}%`)),
        notInArray(fields.id, excludedUserIds.length ? excludedUserIds : [''])
      )
  } else {
    whereClause = (fields: typeof users._.columns, {ilike, or}: any) =>
      or(ilike(fields.name, `%${query}%`), ilike(fields.email, `%${query}%`))
  }

  const rows = await db.query.user.findMany({
    where: whereClause,
    columns: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      image: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      visibility: true,
      twoFactorEnabled: true,
      stripeCustomerId: true,
    },
  })
  return rows
}

/**
 * Vérifie si un email existe déjà dans la base de données
 */
export const isEmailExistsDao = async (email: string): Promise<boolean> => {
  const user = await db.query.user.findFirst({
    where: eq(users.email, email),
  })
  return !!user
}

// CRUD pour les paramètres utilisateur
export const createUserSettingsDao = async (
  settings: AddUserSettingsModel
): Promise<UserSettingsModel> => {
  const [row] = await db.insert(userSettings).values(settings).returning()
  return row
}

export const getUserSettingsByUserIdDao = async (
  userId: string
): Promise<UserSettingsModel | undefined> => {
  const row = await db.query.userSettings.findFirst({
    where: (settings, {eq}) => eq(settings.userId, userId),
  })
  return row
}

export const updateUserSettingsByUserIdDao = async (
  userId: string,
  settings: UpdateUserSettingsModel
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {userId: _, ...rest} = settings
  await db
    .update(userSettings)
    .set({...rest, updatedAt: new Date()})
    .where(eq(userSettings.userId, userId))
}

export const deleteUserSettingsByUserIdDao = async (
  userId: string
): Promise<void> => {
  await db.delete(userSettings).where(eq(userSettings.userId, userId))
}

// Fonction utilitaire pour créer ou mettre à jour les paramètres
export const upsertUserSettingsDao = async (
  userId: string,
  settings: AddUserSettingsModel
): Promise<UserSettingsModel> => {
  const existingSettings = await getUserSettingsByUserIdDao(userId)

  if (existingSettings) {
    await updateUserSettingsByUserIdDao(userId, settings)
    return {...existingSettings, ...settings, updatedAt: new Date()}
  } else {
    return await createUserSettingsDao({...settings, userId})
  }
}

/**
 * Récupère tous les utilisateurs membres d'une organisation
 */
export const getUsersByOrganizationDao = async (
  organizationId: string
): Promise<UserModel[]> => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      image: users.image,
      role: users.role,
      banned: users.banned,
      banReason: users.banReason,
      banExpires: users.banExpires,
      visibility: users.visibility,
      twoFactorEnabled: users.twoFactorEnabled,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .innerJoin(member, eq(users.id, member.userId))
    .where(eq(member.organizationId, organizationId))
    .orderBy(users.name)

  return rows
}

/**
 * Indique si l'utilisateur dispose d'un identifiant mot de passe, donc s'il peut
 * se connecter par lui-même. Un compte créé depuis Stripe n'en a aucun : c'est
 * le seul marqueur stable pour router l'e-mail d'accès, là où « le compte vient
 * d'être créé » bascule d'un rejeu de webhook à l'autre.
 */
export const hasPasswordCredentialDao = async (
  userId: string
): Promise<boolean> => {
  const rows = await db
    .select({id: account.id})
    .from(account)
    .where(and(eq(account.userId, userId), isNotNull(account.password)))
    .limit(1)

  return rows.length > 0
}
