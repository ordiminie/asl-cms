import {
  createOrganizationDao,
  createOrganizationMemberDao,
  deleteInvitationByIdDao,
  deleteOrganizationDao,
  deleteUserInvitationsDao,
  deleteUserOrganizationDao,
  getAllOrganizationsWithPaginationDao,
  getInvitationMembersDao,
  getMembersDao,
  getOrganizationByIdDao,
  getOrganizationBySlugDao,
  getOrganizationMembersDao,
  getOrganizationsByUserIdDao,
  getOrganizationsDao,
  getUserInvitationsDao,
  getUserOrganizationDao,
  getUserRoleInOrganizationDao,
  updateOrganizationDao,
  updateUserOrganizationRoleDao,
} from '@/db/repositories/organization-repository'
import {getAuthUser} from '@/services/authentication/auth-service'

import {
  canChangeOrganizationMemberRole,
  canCreateOrganization,
  canDeleteInvitation,
  canDeleteOrganization,
  canInviteToOrganization,
  canReadOrganization,
  canReadOrganizationMember,
  canRemoveFromOrganization,
  canUpdateOrganization,
} from './authorization/organization-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {Pagination} from './types/common-type'
import {UserOrganizationRoleConst} from './types/domain/auth-types'
import {
  CreateMember,
  CreateOrganization,
  InvitationWithUser,
  MemberOrInvitationDTO,
  OrganizationRole,
  UpdateOrganization,
} from './types/domain/organization-types'
import {uuidSchema} from './validation/common-validation'
import {
  createOrganizationServiceSchema,
  createUserOrganizationServiceSchema,
  organizationRoleSchema,
  organizationUuidSchema,
  updateOrganizationServiceSchema,
  userUuidSchema,
} from './validation/organization-validation'

// ===== CRUD ORGANIZATIONS =====

export const createOrganizationService = async (
  organizationParams: CreateOrganization
) => {
  const granted = await canCreateOrganization()
  if (!granted) {
    throw new AuthorizationError()
  }

  const parsed = createOrganizationServiceSchema.safeParse(organizationParams)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const organizationParamsSanitized = parsed.data

  // Créer l'organisation
  const organization = await createOrganizationDao(organizationParamsSanitized)

  // Ajouter le créateur comme OWNER
  const authUser = await getAuthUser()
  if (authUser?.id) {
    await createOrganizationMemberDao({
      userId: authUser.id,
      organizationId: organization.id,
      role: UserOrganizationRoleConst.OWNER,
      createdAt: new Date(),
    })
  }

  return organization
}

export const getOrganizationByIdService = async (id: string) => {
  const parsed = organizationUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canReadOrganization(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getOrganizationByIdDao(parsedUuid)
}

export const getOrganizationBySlugService = async (slug: string) => {
  const parsed = createOrganizationServiceSchema
    .pick({slug: true})
    .safeParse({slug})
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const slugSanitized = parsed.data.slug

  const organization = await getOrganizationBySlugDao(slugSanitized)
  if (!organization) {
    return
  }

  const granted = await canReadOrganization(organization.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  return organization
}

export const updateOrganizationService = async (
  organizationParams: UpdateOrganization
) => {
  const resourceId = organizationParams.id
  const granted = await canUpdateOrganization(resourceId)
  if (!granted) {
    throw new AuthorizationError()
  }

  organizationParams.updatedAt = new Date()
  const parsed = updateOrganizationServiceSchema.safeParse(organizationParams)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const organizationParamsSanitized = parsed.data
  await updateOrganizationDao(organizationParamsSanitized)
}

export const deleteOrganizationService = async (id: string) => {
  const parsed = organizationUuidSchema.safeParse(id)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canDeleteOrganization(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  await deleteOrganizationDao(parsedUuid)
}

export const getOrganizationsService = async (pagination: Pagination) => {
  return await getOrganizationsDao(pagination)
}

export const getAllOrganizationsWithPaginationService = async (
  pagination: Pagination,
  search?: string
) => {
  // Pour l'administration, on utilise directement le DAO avec recherche
  // TODO: Ajouter une vérification d'autorisation admin si nécessaire
  return await getAllOrganizationsWithPaginationDao(pagination, search)
}

// ===== USER ORGANIZATIONS MANAGEMENT =====

export const getUserOrganizationsService = async (userId?: string) => {
  const authUser = await getAuthUser()
  const targetUserId = userId || authUser?.id

  if (!targetUserId) {
    throw new AuthorizationError()
  }

  const parsed = userUuidSchema.safeParse(targetUserId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  return await getMembersDao(parsedUuid)
}

export const getOrganizationsByUserIdService = async (userId?: string) => {
  const authUser = await getAuthUser()
  const targetUserId = userId || authUser?.id

  if (!targetUserId) {
    throw new AuthorizationError()
  }

  const parsed = userUuidSchema.safeParse(targetUserId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  return await getOrganizationsByUserIdDao(parsedUuid)
}

export const getOrganizationMembersService = async (organizationId: string) => {
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canReadOrganizationMember(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getOrganizationMembersDao(parsedUuid)
}

export const createOrganizationMemberService = async (
  userOrganizationParams: CreateMember
) => {
  const parsed = createUserOrganizationServiceSchema.safeParse(
    userOrganizationParams
  )
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const params = parsed.data

  const granted = await canInviteToOrganization(params.organizationId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier si l'utilisateur n'est pas déjà membre
  const existingMembership = await getUserOrganizationDao(
    params.userId,
    params.organizationId
  )
  if (existingMembership) {
    throw new ValidationError(
      "L'utilisateur est déjà membre de cette organisation"
    )
  }

  return await createOrganizationMemberDao(params)
}

export const removeUserFromOrganizationService = async (
  userId: string,
  organizationId: string
) => {
  const userParsed = userUuidSchema.safeParse(userId)
  const orgParsed = organizationUuidSchema.safeParse(organizationId)

  if (!userParsed.success) {
    throw new ValidationError(userParsed.error.message)
  }
  if (!orgParsed.success) {
    throw new ValidationError(orgParsed.error.message)
  }

  const userIdSanitized = userParsed.data
  const organizationIdSanitized = orgParsed.data

  const granted = await canRemoveFromOrganization(
    organizationIdSanitized,
    userIdSanitized
  )
  if (!granted) {
    throw new AuthorizationError()
  }

  // Empêcher la suppression du OWNER
  const membership = await getUserOrganizationDao(
    userIdSanitized,
    organizationIdSanitized
  )
  if (membership?.role === UserOrganizationRoleConst.OWNER) {
    throw new AuthorizationError(
      "Le propriétaire (OWNER) ne peut pas se retirer lui-même de l'organisation."
    )
  }

  await deleteUserOrganizationDao(userIdSanitized, organizationIdSanitized)
}

export const changeUserOrganizationRoleService = async (
  userId: string,
  organizationId: string,
  role: OrganizationRole
) => {
  const userParsed = userUuidSchema.safeParse(userId)
  const orgParsed = organizationUuidSchema.safeParse(organizationId)
  const roleParsed = organizationRoleSchema.safeParse(role)

  if (!userParsed.success) {
    throw new ValidationError(userParsed.error.message)
  }
  if (!orgParsed.success) {
    throw new ValidationError(orgParsed.error.message)
  }
  if (!roleParsed.success) {
    throw new ValidationError(roleParsed.error.message)
  }

  const userIdSanitized = userParsed.data
  const organizationIdSanitized = orgParsed.data
  const roleSanitized = roleParsed.data

  const granted = await canChangeOrganizationMemberRole(
    organizationIdSanitized,
    userIdSanitized
  )
  if (!granted) {
    throw new AuthorizationError()
  }

  await updateUserOrganizationRoleDao(
    userIdSanitized,
    organizationIdSanitized,
    roleSanitized
  )
}

export const getUserRoleInOrganizationService = async (
  userId: string,
  organizationId: string
) => {
  const userParsed = userUuidSchema.safeParse(userId)
  const orgParsed = organizationUuidSchema.safeParse(organizationId)

  if (!userParsed.success) {
    throw new ValidationError(userParsed.error.message)
  }
  if (!orgParsed.success) {
    throw new ValidationError(orgParsed.error.message)
  }

  const userIdSanitized = userParsed.data
  const organizationIdSanitized = orgParsed.data

  const granted = await canReadOrganization(organizationIdSanitized)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getUserRoleInOrganizationDao(
    userIdSanitized,
    organizationIdSanitized
  )
}

export const getInvitationMembersService = async (
  organizationId: string
): Promise<InvitationWithUser[]> => {
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const organizationIdSanitized = parsed.data

  const granted = await canReadOrganizationMember(organizationIdSanitized)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getInvitationMembersDao(organizationIdSanitized)
}

export async function getMembersAndInvitationsService(
  organizationId: string
): Promise<MemberOrInvitationDTO[]> {
  const [members, invitations] = await Promise.all([
    getOrganizationMembersService(organizationId),
    getInvitationMembersService(organizationId),
  ])

  const memberDTOs = members.map((m) => {
    if (!m.user) {
      throw new Error('User data missing from organization member')
    }
    return {
      memberId: m.id,
      userId: m.user.id,
      invitationId: null,
      organizationId: m.organizationId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image ?? null,
      role: m.role,
      joinedAt: m.createdAt,
      status: 'member' as const,
    }
  })

  const invitationDTOs = invitations.map((i) => ({
    memberId: null,
    userId: i.user?.id ?? '',
    invitationId: i.id,
    organizationId: i.organizationId,
    name: i.user?.name ?? null,
    email: i.email,
    image: i.user?.image ?? null,
    role: i.role,
    joinedAt: i.expiresAt,
    status: 'invited' as const,
  }))

  return [...memberDTOs, ...invitationDTOs]
}

export const getUserInvitationsService = async (): Promise<
  InvitationWithUser[]
> => {
  const authUser = await getAuthUser()
  if (!authUser?.email) {
    throw new AuthorizationError()
  }

  const invitations = await getUserInvitationsDao(authUser.email)

  // Transformer pour correspondre au type InvitationWithUser
  return invitations.map((invitation) => ({
    ...invitation,
    user: authUser, // L'utilisateur connecté est celui qui a reçu l'invitation
  }))
}

export const deleteUserInvitationsService = async (userId: string) => {
  const parsed = userUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const userIdSanitized = parsed.data

  await deleteUserInvitationsDao(userIdSanitized)
}

export const deleteInvitationByIdService = async (invitationId: string) => {
  const granted = await canDeleteInvitation()
  if (!granted) {
    throw new AuthorizationError()
  }

  const parsed = uuidSchema.safeParse(invitationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const invitationIdSanitized = parsed.data

  await deleteInvitationByIdDao(invitationIdSanitized)
}

// ========================================
// USAGE FUNCTIONS
// ========================================

import {
  AdminUsageStats,
  getAdminUsageStatsDao,
  PlanLimits,
} from '@/db/repositories/subscription-repository'

import {canManageUsers} from './authorization/user-authorization'

export interface AdminUserOrganizationWithUsage {
  id: string
  name: string
  slug: string | null
  logo: string | null
  role: string
  usage: AdminUsageStats
}

export const getOrganizationUsageService = async (
  organizationId: string
): Promise<AdminUsageStats> => {
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const parsedUuid = parsed.data

  const granted = await canReadOrganization(parsedUuid)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await getAdminUsageStatsDao(parsedUuid)
}

export const getUserOrganizationsWithUsageService = async (): Promise<
  AdminUserOrganizationWithUsage[]
> => {
  const authUser = await getAuthUser()
  if (!authUser?.id) {
    throw new AuthorizationError()
  }

  const organizations = await getOrganizationsByUserIdDao(authUser.id)

  const orgsWithUsage = await Promise.all(
    organizations.map(async (org) => {
      const usage = await getAdminUsageStatsDao(org.id)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: org.role,
        usage,
      }
    })
  )

  return orgsWithUsage
}

export const getAdminUserOrganizationsWithUsageService = async (
  userId: string
): Promise<AdminUserOrganizationWithUsage[]> => {
  const canManage = await canManageUsers()
  if (!canManage) {
    throw new AuthorizationError()
  }

  const parsed = userUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const userIdSanitized = parsed.data

  const organizations = await getOrganizationsByUserIdDao(userIdSanitized)

  const orgsWithUsage = await Promise.all(
    organizations.map(async (org) => {
      const usage = await getAdminUsageStatsDao(org.id)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: org.role,
        usage,
      }
    })
  )

  return orgsWithUsage
}

export type {AdminUsageStats, PlanLimits}
