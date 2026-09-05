import {OrganizationRoleEnumModel} from '@/db/models/organization-model'

import {Roles, UserDTO} from './user-types'

export type WithAuthProps = {
  user: UserDTO
}

export type SessionPayload = {
  userId?: string | number //used for simple session
  sessionId?: string //used for multisession db
  expiresAt: Date
  role?: Roles
}

export interface SignInError {
  type: 'CredentialsSignin'
  message?: string
  code?: string
}

//Roles GLOBAUX
export const roleHierarchy = [
  'public',
  'user',
  'redactor',
  'moderator',
  'admin',
  'super_admin',
] satisfies Roles[]

// Context pour spécifier l'organisation COURANTE
export interface OrganizationContext {
  organizationId: string // Quelle org est active maintenant
}

// Constantes pour les rôles utilisateur dans une organisation
export const UserOrganizationRoleConst = {
  OWNER: 'owner' satisfies OrganizationRoleEnumModel,
  ADMIN: 'admin' satisfies OrganizationRoleEnumModel,
  MEMBER: 'member' as OrganizationRoleEnumModel,
} as const

// Constantes pour les rôles globaux
export const RoleConst = {
  PUBLIC: 'public' satisfies Roles,
  USER: 'user' satisfies Roles,
  REDACTOR: 'redactor' satisfies Roles,
  MODERATOR: 'moderator' satisfies Roles,
  ADMIN: 'admin' satisfies Roles,
  SUPER_ADMIN: 'super_admin' satisfies Roles,
} as const
