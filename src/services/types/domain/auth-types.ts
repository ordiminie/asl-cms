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

/**
 * Rôles GLOBAUX (s47, ADR 035) : tout compte est `user`, le SuperAdmin
 * Zourite Studio est `super_admin`. Les rôles qui comptent pour une
 * association (Membre, Bureau, Présidence) sont des rôles d'association.
 *
 * Source unique côté domaine, du moins au plus élevé : la hiérarchie et les
 * schémas Zod en dérivent. Son égalité avec l'énuméré `role_type` de la base
 * est vérifiée par `auth-types.test.ts`.
 */
export const GLOBAL_ROLES = [
  'user',
  'super_admin',
] as const satisfies readonly Roles[]

export const roleHierarchy: readonly Roles[] = GLOBAL_ROLES

// Context pour spécifier l'organisation COURANTE
export interface OrganizationContext {
  organizationId: string // Quelle org est active maintenant
}

/**
 * Rôles d'une association (s03b). `ADMIN` porte la valeur `board` : c'est le
 * Bureau de l'association. Le rôle global `admin` de la plateforme n'existe
 * plus (s47). La clé reste `ADMIN` pour limiter l'étendue du renommage ;
 * seule la valeur en base a changé.
 */
export const UserOrganizationRoleConst = {
  OWNER: 'owner' satisfies OrganizationRoleEnumModel,
  ADMIN: 'board' satisfies OrganizationRoleEnumModel,
  MEMBER: 'member' as OrganizationRoleEnumModel,
} as const

// Constantes pour les rôles globaux
export const RoleConst = {
  USER: 'user' satisfies Roles,
  SUPER_ADMIN: 'super_admin' satisfies Roles,
} as const
