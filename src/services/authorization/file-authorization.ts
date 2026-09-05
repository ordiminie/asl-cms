import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {getPostByIdDao} from '@/db/repositories/post-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'

import {getAuthUser} from '../authentication/auth-service'
import {OrganizationContext} from '../types/domain/auth-types'
import {EntityType, EntityTypeConst} from '../types/domain/file-types'
import {User} from '../types/domain/user-types'
import {userCan, userCanOnResource} from './authorization-service'
import {Actions, ActionsConst, SubjectsConst} from './casl-abilities'

/**
 * Vérifie si l'utilisateur peut lire un fichier
 */
export const canReadFile = async (
  entityType: EntityType,
  entityId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce pour éviter les appels DAO inutiles
  if (!userCan(authUser, ActionsConst.READ, SubjectsConst.FILE)) {
    return false
  }

  return await checkFileOwnership(
    authUser,
    entityType,
    entityId,
    ActionsConst.READ
  )
}

/**
 * Vérifie si l'utilisateur peut créer/uploader un fichier
 */
export const canUploadFile = async (
  entityType: EntityType,
  entityId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce
  if (!userCan(authUser, ActionsConst.CREATE, SubjectsConst.FILE)) {
    return false
  }

  return await checkFileOwnership(
    authUser,
    entityType,
    entityId,
    ActionsConst.CREATE
  )
}

/**
 * Vérifie si l'utilisateur peut supprimer un fichier
 */
export const canDeleteFile = async (
  entityType: EntityType,
  entityId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce
  if (!userCan(authUser, ActionsConst.DELETE, SubjectsConst.FILE)) {
    return false
  }

  return await checkFileOwnership(
    authUser,
    entityType,
    entityId,
    ActionsConst.DELETE
  )
}

/**
 * Vérifie si l'utilisateur peut lister les fichiers d'une entité
 */
export const canListFiles = async (
  entityType: EntityType,
  entityId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Vérification précoce
  if (!userCan(authUser, ActionsConst.READ, SubjectsConst.FILE)) {
    return false
  }

  return await checkFileOwnership(
    authUser,
    entityType,
    entityId,
    ActionsConst.READ
  )
}

/**
 * Fonction utilitaire pour vérifier la propriété/accès à une entité
 */
async function checkFileOwnership(
  authUser: User | undefined,
  entityType: EntityType,
  entityId: string,
  action: Actions
): Promise<boolean> {
  switch (entityType) {
    case EntityTypeConst.USER: {
      // Vérifier si l'utilisateur peut accéder à ce profil utilisateur
      const targetUser = await getUserByIdDao(entityId)
      if (!targetUser) return false

      return userCanOnResource(authUser, action, SubjectsConst.FILE, {
        userId: targetUser.id,
      })
    }

    case EntityTypeConst.ORGANIZATION: {
      // Vérifier si l'utilisateur fait partie de l'organisation
      const organization = await getOrganizationByIdDao(entityId)
      if (!organization) return false

      // Créer le contexte organisationnel pour CASL
      const orgContext: OrganizationContext = {
        organizationId: organization.id,
      }

      // Vérifier si l'utilisateur a des permissions sur cette organisation
      return userCanOnResource(
        authUser,
        action,
        SubjectsConst.FILE,
        {
          organizationId: organization.id,
        },
        orgContext
      )
    }

    case EntityTypeConst.POST: {
      // Vérifier si l'utilisateur peut modifier le post
      const post = await getPostByIdDao(entityId)
      if (!post) return false

      // Utiliser les mêmes permissions que pour la modification de post
      return userCanOnResource(authUser, action, SubjectsConst.POST, {
        id: post.id,
        status: post.status,
        authorId: post.authorId,
      })
    }

    case EntityTypeConst.PRODUCT:
    case EntityTypeConst.GENERIC:
      // Pour les produits et fichiers génériques, vérifier si l'utilisateur connecté
      // peut gérer ses propres fichiers (pour l'instant on considère qu'ils appartiennent à l'utilisateur)
      if (!authUser) return false

      return userCanOnResource(authUser, action, SubjectsConst.FILE, {
        userId: authUser.id,
      })

    default:
      return false
  }
}

/**
 * Vérifie si l'utilisateur peut accéder à un fichier par son chemin
 * Parse le chemin pour extraire le type d'entité et l'ID
 */
export const canAccessFileByPath = async (path: string): Promise<boolean> => {
  // Parse le chemin pour extraire entityType et entityId
  // Format attendu: "users/123/profile-timestamp.jpg" ou "organizations/456/logo-timestamp.png"
  const pathParts = path.split('/')

  if (pathParts.length < 2) {
    return false
  }

  // Extraire le type d'entité (en retirant le 's' final)
  const entityTypePlural = pathParts[0]
  const entityId = pathParts[1]

  let entityType: EntityType
  switch (entityTypePlural) {
    case 'users':
      entityType = EntityTypeConst.USER
      break
    case 'organizations':
      entityType = EntityTypeConst.ORGANIZATION
      break
    case 'products':
      entityType = EntityTypeConst.PRODUCT
      break
    case 'posts':
      entityType = EntityTypeConst.POST
      break
    default:
      entityType = EntityTypeConst.GENERIC
      break
  }

  return await canReadFile(entityType, entityId)
}
