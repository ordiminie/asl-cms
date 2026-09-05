import {Session} from 'better-auth'

import {
  AddUserModel,
  AddUserSettingsModel,
  LanguageEnumModel,
  NotificationChannelEnumModel,
  RoleEnumModel,
  ThemeEnumModel,
  UpdateUserModel,
  UpdateUserSettingsModel,
  UserModel,
  UserSettingsModel,
} from '@/db/models/user-model'

import {Notification} from './notification-types'
import {MemberData} from './organization-types'

// ICI les TYPES DE DOMAIN sont EGAUX aux types drizzle
// Les fichier types DOMAINS sont la pour décorréler les types de drizzle des types de domaine (services)

export type User = UserModel & {
  organizations?: MemberData[]
  settings?: UserSettings
  notifications?: Notification[]
}

// Types pour les paramètres utilisateur
export type UserSettings = UserSettingsModel
export type CreateUserSettings = AddUserSettingsModel
export type UpdateUserSettings = UpdateUserSettingsModel
export type Theme = ThemeEnumModel
export type Language = LanguageEnumModel
export type NotificationChannel = NotificationChannelEnumModel

export type RequireAuthOptions = {
  roles?: Roles[]
  active?: boolean
  uid?: string
}
export type UserVisibility = User['visibility']

// Types pour les rôles
// export type Role = RoleModel
// export type UserRole = UserRoleModel
export type Roles = RoleEnumModel

// Utilisateur avec ses rôles
//@deprecated
export type UserWithRoles = User & {
  role: Roles
}

export type CreateUser = Pick<AddUserModel, 'email' | 'name'>
export type UpdateUser = {
  id: string
} & Partial<Omit<UpdateUserModel, 'id'>>

// Type spécifique pour la création d'utilisateur via Stripe
export type CreateUserFromStripe = {
  email: string
  name?: string
  stripeCustomerId?: string
}

//DTO = Data Transfer Object
export type UserDTO = {
  id: string
  email: string
  name?: string
  role?: string
  image?: string
}

export type AuthUser = {
  session?: Session
  user?: UserWithRoles
  roles: Roles[]
}

// Types pour la gestion des rôles
export type AssignRoleToUser = {
  userId: string
  roleId: string
  assignedBy?: string
}

export type RolePermission = {
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  canAdmin: boolean
}

export type UserPermissions = {
  [key: string]: RolePermission
}
