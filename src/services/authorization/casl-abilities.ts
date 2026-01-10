import {AbilityBuilder, createMongoAbility} from '@casl/ability'

import {
  OrganizationContext,
  UserOrganizationRoleConst,
} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
// Actions disponibles
export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage'

// Type pour l'AbilityBuilder
type AppAbilityBuilder = AbilityBuilder<ReturnType<typeof createMongoAbility>>

// Subjects (ressources) disponibles
export type Subjects =
  | 'User'
  | 'Subscription'
  | 'Organization'
  | 'Project'
  | 'Task'
  | 'File'
  | 'Technical'
  | 'Log'
  | 'Notification'
  | 'Post'
  | 'Category'
  | 'Hashtag'
  | 'Credit'
  | 'all'

// Constantes pour les actions et subjects
export const ActionsConst = {
  CREATE: 'create' as Actions,
  READ: 'read' as Actions,
  UPDATE: 'update' as Actions,
  DELETE: 'delete' as Actions,
  MANAGE: 'manage' as Actions,
} as const

export const SubjectsConst = {
  USER: 'User' as Subjects,
  SUBSCRIPTION: 'Subscription' as Subjects,
  ORGANIZATION: 'Organization' as Subjects,
  PROJECT: 'Project' as Subjects,
  TASK: 'Task' as Subjects,
  FILE: 'File' as Subjects,
  TECHNICAL: 'Technical' as Subjects,
  LOG: 'Log' as Subjects,
  NOTIFICATION: 'Notification' as Subjects,
  POST: 'Post' as Subjects,
  CATEGORY: 'Category' as Subjects,
  HASHTAG: 'Hashtag' as Subjects,
  CREDIT: 'Credit' as Subjects,
  ALL: 'all' as Subjects,
} as const
/**
 * Build abilities pour les utilisateurs non authentifiés (guests)
 */
export function buildGuestAbilities(builder: AppAbilityBuilder) {
  const {can} = builder

  // Utilisateurs non authentifiés (guests)
  can(ActionsConst.READ, SubjectsConst.LOG, ['id', 'name'])

  // Peut lire les profils publics d'utilisateurs
  can(ActionsConst.READ, SubjectsConst.USER, {visibility: 'public'})

  // Peut lire les posts publiés, catégories et hashtags (lecture publique)
  can(ActionsConst.READ, SubjectsConst.POST, {status: 'published'})
  can(ActionsConst.READ, SubjectsConst.CATEGORY)
  can(ActionsConst.READ, SubjectsConst.HASHTAG)
}

/**
 * Build abilities pour SUPER_ADMIN - permissions complètes
 */
export function buildSuperAdminAbilities(builder: AppAbilityBuilder) {
  const {can} = builder

  // Permissions complètes sur toutes les ressources
  can(ActionsConst.MANAGE, SubjectsConst.ALL)
}

/**
 * Build abilities pour ADMIN - permissions étendues
 */
export function buildAdminAbilities(builder: AppAbilityBuilder) {
  const {can} = builder

  // Peut gérer tous les utilisateurs
  can(ActionsConst.MANAGE, SubjectsConst.USER)

  // Peut gérer toutes les subscriptions
  can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION)

  // Peut gérer toutes les organisations
  can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)

  // Peut gérer tous les projets et tâches
  can(ActionsConst.MANAGE, SubjectsConst.PROJECT)
  can(ActionsConst.MANAGE, SubjectsConst.TASK)

  // Peut gérer tous les fichiers
  can(ActionsConst.MANAGE, SubjectsConst.FILE)

  // Peut gérer les aspects techniques et logs
  can(ActionsConst.MANAGE, SubjectsConst.TECHNICAL)
  can(ActionsConst.MANAGE, SubjectsConst.LOG)

  // Peut gérer toutes les notifications (créer des notifications système)
  can(ActionsConst.MANAGE, SubjectsConst.NOTIFICATION)

  // Peut gérer tous les posts, catégories et hashtags
  can(ActionsConst.MANAGE, SubjectsConst.POST)
  can(ActionsConst.MANAGE, SubjectsConst.CATEGORY)
  can(ActionsConst.MANAGE, SubjectsConst.HASHTAG)

  // Peut gérer tous les crédits (grant, read, etc.)
  can(ActionsConst.MANAGE, SubjectsConst.CREDIT)
}

/**
 * Build abilities pour USER - permissions standards avec gestion des rôles organisationnels
 */
export function buildUserAbilities(
  builder: AppAbilityBuilder,
  user: User,
  orgContext?: OrganizationContext
) {
  // Récupérer le rôle de l'utilisateur dans l'organisation courante
  let userOrgRole: OrganizationRole | undefined
  if (orgContext?.organizationId && user.organizations) {
    const userOrg = user.organizations.find(
      (org) => org.organizationId === orgContext.organizationId
    )
    userOrgRole = userOrg?.role
  }

  // Permissions de base pour tous les utilisateurs connectés
  buildBaseUserAbilities(builder, user)

  // Permissions organisationnelles basées sur le rôle dans l'organisation
  if (orgContext?.organizationId && userOrgRole) {
    buildOrganizationalAbilities(builder, user, userOrgRole, orgContext)
  }
}

/**
 * Build abilities de base pour tous les utilisateurs connectés
 */
export function buildBaseUserAbilities(builder: AppAbilityBuilder, user: User) {
  const {can, cannot} = builder

  // Utilisateurs - peut lire et modifier son propre profil
  can(ActionsConst.READ, SubjectsConst.USER, {id: user.id})
  can(ActionsConst.UPDATE, SubjectsConst.USER, {id: user.id})

  // Peut lire les profils publics d'autres utilisateurs
  can(ActionsConst.READ, SubjectsConst.USER, {visibility: 'public'})

  // Restrictions sur les champs sensibles des utilisateurs
  cannot(ActionsConst.READ, SubjectsConst.USER, [
    'role',
    'permissions',
    'internalNotes',
  ])
  cannot(ActionsConst.UPDATE, SubjectsConst.USER, [
    'role',
    'permissions',
    'createdAt',
    'updatedAt',
  ])

  // Subscriptions - peut lire et modifier ses propres subscriptions
  can(ActionsConst.READ, SubjectsConst.SUBSCRIPTION, {userId: user.id})
  can(ActionsConst.UPDATE, SubjectsConst.SUBSCRIPTION, {userId: user.id})
  can(ActionsConst.CREATE, SubjectsConst.SUBSCRIPTION)

  // Organizations - permissions de base
  can(ActionsConst.READ, SubjectsConst.ORGANIZATION) // Peut lire toutes les orgs (public info)
  can(ActionsConst.CREATE, SubjectsConst.ORGANIZATION) // Peut créer une organisation

  // Notifications - peut lire et gérer ses propres notifications
  can(ActionsConst.READ, SubjectsConst.NOTIFICATION, {userId: user.id})
  can(ActionsConst.UPDATE, SubjectsConst.NOTIFICATION, {userId: user.id})
  can(ActionsConst.DELETE, SubjectsConst.NOTIFICATION, {userId: user.id})

  // Files - peut gérer ses propres fichiers
  can(ActionsConst.MANAGE, SubjectsConst.FILE, {userId: user.id})

  // Peut lire les logs (accès en lecture seule)
  can(ActionsConst.READ, SubjectsConst.LOG)

  // Posts - peut lire les posts publiés, créer ses propres posts et les gérer
  can(ActionsConst.READ, SubjectsConst.POST, {status: 'published'})
  can(ActionsConst.CREATE, SubjectsConst.POST)
  can(ActionsConst.MANAGE, SubjectsConst.POST, {authorId: user.id})

  // Catégories et Hashtags - lecture pour tous, création limitée selon le rôle
  can(ActionsConst.READ, SubjectsConst.CATEGORY)
  can(ActionsConst.READ, SubjectsConst.HASHTAG)

  // Ne peut pas supprimer d'autres utilisateurs
  cannot(ActionsConst.DELETE, SubjectsConst.USER)

  // Crédits - permissions de base (lecture via organisation)
  // Les permissions de consommation et achat sont gérées au niveau organisationnel
}

/**
 * Build abilities organisationnelles basées sur le rôle dans l'organisation
 */
export function buildOrganizationalAbilities(
  builder: AppAbilityBuilder,
  user: User,
  orgRole: OrganizationRole,
  orgContext: OrganizationContext
) {
  const {can} = builder

  switch (orgRole) {
    case UserOrganizationRoleConst.OWNER:
      // Le propriétaire a toutes les permissions sur l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION, {
        id: orgContext.organizationId,
      })
      // Peut gérer tous les utilisateurs de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.USER, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer toutes les subscriptions de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer tous les projets et tâches de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.PROJECT, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.MANAGE, SubjectsConst.TASK, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer tous les fichiers de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.FILE, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer les crédits de l'organisation (lire, consommer, acheter des packs)
      can(ActionsConst.MANAGE, SubjectsConst.CREDIT, {
        organizationId: orgContext.organizationId,
      })
      break

    case UserOrganizationRoleConst.ADMIN:
      // L'admin peut gérer l'organisation (sauf suppression)
      can(ActionsConst.READ, SubjectsConst.ORGANIZATION, {
        id: orgContext.organizationId,
      })
      can(ActionsConst.UPDATE, SubjectsConst.ORGANIZATION, {
        id: orgContext.organizationId,
      })
      // Peut gérer les utilisateurs de l'organisation (sauf propriétaire)
      can(ActionsConst.READ, SubjectsConst.USER, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.UPDATE, SubjectsConst.USER, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer les subscriptions de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer les projets et tâches de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.PROJECT, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.MANAGE, SubjectsConst.TASK, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer les fichiers de l'organisation
      can(ActionsConst.MANAGE, SubjectsConst.FILE, {
        organizationId: orgContext.organizationId,
      })
      // Peut gérer les crédits de l'organisation (lire, consommer, acheter des packs)
      can(ActionsConst.MANAGE, SubjectsConst.CREDIT, {
        organizationId: orgContext.organizationId,
      })
      break

    case UserOrganizationRoleConst.MEMBER:
      // Le membre a des permissions limitées
      can(ActionsConst.READ, SubjectsConst.ORGANIZATION, {
        id: orgContext.organizationId,
      })
      // Peut lire les autres utilisateurs de l'organisation
      can(ActionsConst.READ, SubjectsConst.USER, {
        organizationId: orgContext.organizationId,
      })
      // Peut lire les subscriptions de l'organisation
      can(ActionsConst.READ, SubjectsConst.SUBSCRIPTION, {
        organizationId: orgContext.organizationId,
      })
      // Peut lire les projets et créer/modifier ses tâches
      can(ActionsConst.READ, SubjectsConst.PROJECT, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.READ, SubjectsConst.TASK, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.CREATE, SubjectsConst.TASK, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.UPDATE, SubjectsConst.TASK, {
        organizationId: orgContext.organizationId,
      })
      // Peut lire les fichiers de l'organisation
      can(ActionsConst.READ, SubjectsConst.FILE, {
        organizationId: orgContext.organizationId,
      })
      // Peut lire et consommer les crédits de l'organisation (pas d'achat)
      can(ActionsConst.READ, SubjectsConst.CREDIT, {
        organizationId: orgContext.organizationId,
      })
      can(ActionsConst.UPDATE, SubjectsConst.CREDIT, {
        organizationId: orgContext.organizationId,
      })
      break

    default:
      // Aucune permission organisationnelle spécifique
      break
  }
}
