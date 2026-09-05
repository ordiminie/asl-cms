import {
  RoleConst,
  roleHierarchy,
  UserOrganizationRoleConst,
} from '../types/domain/auth-types'
import {Roles, User} from '../types/domain/user-types'

export function hasRequiredRole(userConnected?: User, requestedRole?: Roles) {
  if (!userConnected || !requestedRole) {
    return false
  }

  // Vérifier que l'utilisateur a un rôle
  const userRole = userConnected?.role ?? 'public'
  const requestedRoleIndex = roleHierarchy.indexOf(requestedRole)

  if (requestedRoleIndex === -1) {
    return false
  }

  // Vérifier si le rôle de l'utilisateur est supérieur ou égal au rôle requis
  const userRoleIndex = roleHierarchy.indexOf(userRole as Roles)
  return userRoleIndex !== -1 && userRoleIndex >= requestedRoleIndex
}

export function hasRequiredRoles(
  userConnected?: User,
  requestedRoles?: Roles[]
) {
  if (!userConnected || !requestedRoles || requestedRoles.length === 0) {
    return false
  }

  // Vérifier que l'utilisateur a un rôle
  const userRole = userConnected?.role ?? 'public'

  // Vérifier si l'utilisateur a un des rôles requis
  return requestedRoles.some((requestedRole) => {
    const requestedRoleIndex = roleHierarchy.indexOf(requestedRole)
    if (requestedRoleIndex === -1) return false

    const userRoleIndex = roleHierarchy.indexOf(userRole as Roles)
    return userRoleIndex !== -1 && userRoleIndex >= requestedRoleIndex
  })
}

export const isAdmin = (user?: User | null) => {
  if (!user) return false
  return user?.role === RoleConst.ADMIN || user?.role === RoleConst.SUPER_ADMIN
}

export const isOrganizationAdmin = async (
  user: User,
  organizationId: string
) => {
  return user?.organizations?.some(
    (organization) =>
      organization.organizationId === organizationId &&
      organization.role === UserOrganizationRoleConst.ADMIN
  )
}

export const isOrganizationOwner = async (
  user: User,
  organizationId: string
) => {
  return user?.organizations?.some(
    (organization) =>
      organization.organizationId === organizationId &&
      organization.role === UserOrganizationRoleConst.OWNER
  )
}

export const isOrganizationMember = async (
  user: User,
  organizationId: string
) => {
  return user?.organizations?.some(
    (organization) =>
      organization.organizationId === organizationId &&
      organization.role === UserOrganizationRoleConst.MEMBER
  )
}
