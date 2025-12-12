import 'server-only'

import {cache} from 'react'

import {getAuthUser} from '@/services/authentication/auth-service'
import {hasRequiredRoles} from '@/services/authentication/auth-util'
import {isUserAdmin} from '@/services/authorization/authorization-service'
import {canManageUsers} from '@/services/authorization/user-authorization'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  getAllUsersWithPaginationService,
  getUserByIdService,
  getUsersByOrganizationService,
} from '@/services/facades/user-service-facade'
import {
  RequireAuthOptions,
  Roles,
  User,
  UserDTO,
} from '@/services/types/domain/user-types'

/**
 * A light DTO user
 */
export const getAuthUserDTO = cache(async () => {
  const user = await getAuthUser()
  if (!user) return
  return userDTO(user as User)
})

/**
 * Require authentication and authorization for a server action
 * @param options - The options for the action
 * @returns The user
 */
export const requireActionAuth = cache(async (options?: RequireAuthOptions) => {
  const user = await getAuthUser()
  const isAdmin = isUserAdmin(user)

  if (!user) {
    throw new AuthorizationError('Utilisateur non authentifié')
  }
  // authoriser seulement un uid particulier
  if (options?.uid && user.id !== options.uid && !isAdmin) {
    throw new AuthorizationError('Accès interdit')
  }
  if (
    options?.roles &&
    !hasRequiredRoles(user, options.roles as unknown as Roles[])
  ) {
    throw new AuthorizationError('Accès interdit')
  }

  return user
})

export function userDTO(user: User): UserDTO | undefined {
  if (!user) return undefined

  return {
    id: user?.id ?? '',
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: user?.role,
    image: user?.image ?? '',
  }
}

export const getAllUsersWithPaginationDal = cache(
  async (pagination: {limit: number; offset: number}, search?: string) => {
    return await getAllUsersWithPaginationService(pagination, search)
  }
)

export const getUserPermissionsDal = cache(async () => {
  const canManage = await canManageUsers()

  return {
    canCreate: canManage,
    canEdit: canManage,
    canDelete: canManage,
    canManage,
  }
})

export const getUsersByOrganizationDal = cache(
  async (organizationId: string) => {
    return await getUsersByOrganizationService(organizationId)
  }
)

export const getUserByIdDal = cache(async (userId: string) => {
  return await getUserByIdService(userId)
})

// ========================================
// ADMIN USAGE FUNCTIONS
// ========================================

import {getAdminUserOrganizationsWithUsageService} from '@/services/facades/organization-service-facade'

export const getAdminUserOrganizationsWithUsageDal = cache(
  async (userId: string) => {
    return await getAdminUserOrganizationsWithUsageService(userId)
  }
)
