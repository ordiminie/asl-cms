import {AbilityBuilder, createMongoAbility} from '@casl/ability'

import {
  OrganizationContext,
  RoleConst,
  UserOrganizationRoleConst,
} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import type {User} from '../types/domain/user-types'
import {
  Actions,
  buildAdminAbilities,
  buildGuestAbilities,
  buildSuperAdminAbilities,
  buildUserAbilities,
  Subjects,
} from './casl-abilities'

export const SubjectsConst = {
  USER: 'user' as Subjects,
  SUBSCRIPTION: 'subscription' as Subjects,
  ORGANIZATION: 'organization' as Subjects,
  PROJECT: 'project' as Subjects,
  TASK: 'task' as Subjects,
  FILE: 'file' as Subjects,
  TECHNICAL: 'technical' as Subjects,
  LOG: 'log' as Subjects,
  ALL: 'all' as Subjects,
} as const

/**
 * Utilitaire pour créer une ability pour un utilisateur donné
 * Équivalent simplifié de la fonction defineAbilitiesFor
 */
export function createUserAbility(user?: User) {
  return defineAbilitiesFor(user)
}
/**
 * Définit les abilities pour un utilisateur donné
 * Inspiré de l'exemple CASL documentation
 * Remplace rbac-config.ts par une approche CASL plus moderne
 */
export function defineAbilitiesFor(
  user?: User,
  orgContext?: OrganizationContext
) {
  const builder = new AbilityBuilder(createMongoAbility)

  if (!user) {
    buildGuestAbilities(builder)
    return builder.build()
  }

  // SUPER_ADMIN - permissions complètes
  if (user.role === RoleConst.SUPER_ADMIN) {
    buildSuperAdminAbilities(builder)
    return builder.build()
  }

  // ADMIN - permissions étendues
  if (user.role === RoleConst.ADMIN) {
    buildAdminAbilities(builder)
    return builder.build()
  }

  // USER - permissions standards
  if (user.role === RoleConst.USER) {
    buildUserAbilities(builder, user, orgContext)
    return builder.build()
  }

  // MODERATOR/REDACTOR - même permissions que user pour le moment
  if (user.role === RoleConst.MODERATOR || user.role === RoleConst.REDACTOR) {
    buildUserAbilities(builder, user, orgContext)
    return builder.build()
  }

  // PUBLIC ou role non defini - permissions guest
  if (!user.role || user.role === RoleConst.PUBLIC) {
    buildGuestAbilities(builder)
    return builder.build()
  }

  // Fallback : Permissions par défaut pour utilisateurs connectés sans rôle spécifique connu
  buildGuestAbilities(builder)
  return builder.build()
}

/**
 * Vérifie si un utilisateur peut effectuer une action sur un type de ressource
 */
export function userCan(
  user: User | undefined,
  action: Actions,
  subject: Subjects,
  orgContext?: OrganizationContext
): boolean {
  const ability = defineAbilitiesFor(user, orgContext)
  return ability.can(action, subject)
}

/**
 * Vérifie si un utilisateur ne peut pas effectuer une action
 */
export function userCannot(
  user: User | undefined,
  action: Actions,
  subject: Subjects,
  orgContext?: OrganizationContext
): boolean {
  const ability = defineAbilitiesFor(user, orgContext)
  return ability.cannot(action, subject)
}

/**
 * Vérifie si un utilisateur peut effectuer une action sur un objet spécifique
 */
export function userCanOnResource(
  user: User | undefined,
  action: Actions,
  subject: Subjects,
  resource: Record<string, unknown>,
  orgContext?: OrganizationContext
): boolean {
  const ability = defineAbilitiesFor(user, orgContext)

  // CASL avec conditions: on crée un objet "subject" que CASL peut reconnaître
  // CASL va matcher les conditions définies dans les règles (ex: {id: user.id})
  const subjectObject = Object.assign({}, resource)

  // On utilise l'API interne de CASL pour vérifier avec des conditions
  const rules = ability.rulesFor(action, subject)

  // Si aucune règle, permission refusée
  if (rules.length === 0) {
    return false
  }

  // Vérifier si au moins une règle permet l'accès
  return rules.some((rule) => {
    if (!rule.conditions) {
      return true // Règle sans condition = permission globale
    }

    // Vérifier si l'objet match les conditions de la règle
    return Object.keys(rule.conditions).every((key) => {
      const ruleValue = rule.conditions?.[key]
      const objectValue = subjectObject[key]
      return ruleValue === objectValue
    })
  })
}

/**
 * Filtre les champs d'une ressource selon les permissions
 */
export function filterFields<T extends Record<string, unknown>>(
  user: User | undefined,
  action: Actions,
  subject: Subjects,
  data: T,
  orgContext?: OrganizationContext
): Partial<T> {
  const ability = defineAbilitiesFor(user, orgContext)

  // Vérifier si l'utilisateur peut effectuer l'action
  if (!ability.can(action, subject)) {
    return {}
  }

  // Pour le filtrage des champs, on retourne les données telles quelles
  // La restriction se fait au niveau des règles CASL définies
  return data
}

/**
 * Vérifie si l'utilisateur authentifié est admin
 * Fonction de compatibilité
 */
export function isUserAdmin(user?: User): boolean {
  if (!user) return false
  return user.role === RoleConst.ADMIN || user.role === RoleConst.SUPER_ADMIN
}

/**
 * Récupère le rôle de l'utilisateur dans une organisation spécifique
 */
export function getUserRoleInOrganization(
  user: User | undefined,
  organizationId: string
): OrganizationRole | undefined {
  if (!user?.organizations) return undefined

  const userOrg = user.organizations.find(
    (org) => org.organizationId === organizationId
  )
  return userOrg?.role
}

/**
 * Vérifie si un utilisateur a un rôle spécifique dans une organisation
 */
export function hasOrganizationRole(
  user: User | undefined,
  organizationId: string,
  role: OrganizationRole
): boolean {
  const userRole = getUserRoleInOrganization(user, organizationId)
  return userRole === role
}

/**
 * Vérifie si un utilisateur est propriétaire d'une organisation
 */
export function isOrganizationOwner(
  user: User | undefined,
  organizationId: string
): boolean {
  return hasOrganizationRole(
    user,
    organizationId,
    UserOrganizationRoleConst.OWNER
  )
}

/**
 * Vérifie si un utilisateur est admin d'une organisation
 */
export function isOrganizationAdmin(
  user: User | undefined,
  organizationId: string
): boolean {
  return hasOrganizationRole(
    user,
    organizationId,
    UserOrganizationRoleConst.ADMIN
  )
}
