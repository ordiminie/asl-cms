import {
  getCategoryByIdDao,
  getHashtagByIdDao,
  getPostByIdDao,
  getPostTranslationByIdDao,
} from '@/db/repositories/post-repository'
import {getAuthUser} from '@/services/authentication/auth-service'

import {POST_STATUS} from '../types/domain/post-types'
import {userCanOnResource} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'

/**
 * Système d'autorisation pour les posts et blog avec gestion des rôles
 *
 * Permissions par rôle global :
 * - ADMIN/SUPER_ADMIN : Peut gérer tous les posts, catégories et hashtags
 * - MODERATOR : Peut modérer les posts publiés
 * - REDACTOR : Peut créer et gérer ses posts + publier
 * - USER : Peut créer et gérer ses propres posts (draft uniquement)
 * - PUBLIC/GUEST : Peut lire les posts publiés
 *
 * Règles spécifiques :
 * - Auteur du post : Peut toujours modifier/supprimer ses propres posts
 * - Posts publiés : Lecture publique autorisée
 * - Posts draft : Seul l'auteur et les admins/modérateurs peuvent lire
 * - Catégories/Hashtags : Création limitée aux rôles REDACTOR et plus
 */

// ===== AUTORISATION POSTS =====

/**
 * Vérifie si l'utilisateur connecté peut créer un post
 */
export const canCreatePost = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(
    authUser,
    ActionsConst.CREATE,
    SubjectsConst.POST,
    {}
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire un post
 */
export const canReadPost = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier le statut et l'auteur
  const post = await getPostByIdDao(resourceId)
  if (!post) return false

  return userCanOnResource(authUser, ActionsConst.READ, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour un post
 */
export const canUpdatePost = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier l'auteur
  const post = await getPostByIdDao(resourceId)
  if (!post) return false

  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer un post
 */
export const canDeletePost = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier l'auteur
  const post = await getPostByIdDao(resourceId)
  if (!post) return false

  return userCanOnResource(authUser, ActionsConst.DELETE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut publier un post
 */
export const canPublishPost = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier l'auteur et le statut actuel
  const post = await getPostByIdDao(resourceId)
  if (!post) return false

  // Seuls les posts en draft peuvent être publiés
  if (post.status === POST_STATUS.PUBLISHED) return false

  // Vérifier les permissions de modification (l'autorisation de publier suit les mêmes règles)
  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut dépublier un post
 */
export const canUnpublishPost = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier l'auteur et le statut actuel
  const post = await getPostByIdDao(resourceId)
  if (!post) return false

  // Seuls les posts publiés peuvent être dépubliés
  if (post.status !== POST_STATUS.PUBLISHED) return false

  // Vérifier les permissions de modification
  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut archiver un post
 */
export const canArchivePost = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier l'auteur
  const post = await getPostByIdDao(resourceId)
  if (!post) return false

  // Ne peut pas archiver un post déjà archivé
  if (post.status === POST_STATUS.ARCHIVED) return false

  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

// ===== AUTORISATION POST TRANSLATIONS =====

/**
 * Vérifie si l'utilisateur connecté peut créer une traduction pour un post
 */
export const canCreatePostTranslation = async (
  postId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le post pour vérifier l'auteur
  const post = await getPostByIdDao(postId)
  if (!post) return false

  // Utilise les mêmes permissions que la mise à jour du post
  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut lire une traduction
 */
export const canReadPostTranslation = async (
  translationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la traduction et le post associé
  const translation = await getPostTranslationByIdDao(translationId)
  if (!translation) return false

  const post = await getPostByIdDao(translation.postId)
  if (!post) return false

  return userCanOnResource(authUser, ActionsConst.READ, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour une traduction
 */
export const canUpdatePostTranslation = async (
  translationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la traduction et le post associé
  const translation = await getPostTranslationByIdDao(translationId)
  if (!translation) return false

  const post = await getPostByIdDao(translation.postId)
  if (!post) return false

  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer une traduction
 */
export const canDeletePostTranslation = async (
  translationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la traduction et le post associé
  const translation = await getPostTranslationByIdDao(translationId)
  if (!translation) return false

  const post = await getPostByIdDao(translation.postId)
  if (!post) return false

  return userCanOnResource(authUser, ActionsConst.UPDATE, SubjectsConst.POST, {
    id: post.id,
    status: post.status,
    authorId: post.authorId,
  })
}

// ===== AUTORISATION CATEGORIES =====

/**
 * Vérifie si l'utilisateur connecté peut créer une catégorie
 */
export const canCreateCategory = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(
    authUser,
    ActionsConst.CREATE,
    SubjectsConst.CATEGORY,
    {}
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire une catégorie
 */
export const canReadCategory = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la catégorie pour vérifier son existence
  const category = await getCategoryByIdDao(resourceId)
  if (!category) return false

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.CATEGORY,
    {
      id: category.id,
    }
  )
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour une catégorie
 */
export const canUpdateCategory = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la catégorie pour vérifier son existence
  const category = await getCategoryByIdDao(resourceId)
  if (!category) return false

  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.CATEGORY,
    {
      id: category.id,
    }
  )
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer une catégorie
 */
export const canDeleteCategory = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la catégorie pour vérifier son existence
  const category = await getCategoryByIdDao(resourceId)
  if (!category) return false

  return userCanOnResource(
    authUser,
    ActionsConst.DELETE,
    SubjectsConst.CATEGORY,
    {
      id: category.id,
    }
  )
}

// ===== AUTORISATION HASHTAGS =====

/**
 * Vérifie si l'utilisateur connecté peut créer un hashtag
 */
export const canCreateHashtag = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(
    authUser,
    ActionsConst.CREATE,
    SubjectsConst.HASHTAG,
    {}
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire un hashtag
 */
export const canReadHashtag = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le hashtag pour vérifier son existence
  const hashtag = await getHashtagByIdDao(resourceId)
  if (!hashtag) return false

  return userCanOnResource(authUser, ActionsConst.READ, SubjectsConst.HASHTAG, {
    id: hashtag.id,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour un hashtag
 */
export const canUpdateHashtag = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le hashtag pour vérifier son existence
  const hashtag = await getHashtagByIdDao(resourceId)
  if (!hashtag) return false

  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.HASHTAG,
    {
      id: hashtag.id,
    }
  )
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer un hashtag
 */
export const canDeleteHashtag = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le hashtag pour vérifier son existence
  const hashtag = await getHashtagByIdDao(resourceId)
  if (!hashtag) return false

  return userCanOnResource(
    authUser,
    ActionsConst.DELETE,
    SubjectsConst.HASHTAG,
    {
      id: hashtag.id,
    }
  )
}

// ===== AUTORISATION LECTURE MULTIPLE =====

/**
 * Vérifie si l'utilisateur connecté peut lire tous les posts
 */
export const canReadAllPosts = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(authUser, ActionsConst.READ, SubjectsConst.POST, {})
}

/**
 * Vérifie si l'utilisateur connecté peut lire ses propres posts
 */
export const canReadOwnPosts = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  if (!authUser) return false

  return userCanOnResource(authUser, ActionsConst.READ, SubjectsConst.POST, {
    authorId: authUser.id,
  })
}

/**
 * Vérifie si l'utilisateur connecté peut lire toutes les catégories
 */
export const canReadAllCategories = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.CATEGORY,
    {}
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire tous les hashtags
 */
export const canReadAllHashtags = async (): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.HASHTAG,
    {}
  )
}

// ===== AUTORISATION OPÉRATIONS EN BULK =====

/**
 * Vérifie si l'utilisateur connecté peut effectuer des opérations en bulk sur les posts
 */
export const canBulkUpdatePosts = async (
  postIds: string[]
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Si l'utilisateur est admin, il peut tout faire
  if (
    userCanOnResource(authUser, ActionsConst.MANAGE, SubjectsConst.POST, {})
  ) {
    return true
  }

  // Sinon, vérifier qu'il est propriétaire de tous les posts
  for (const postId of postIds) {
    const canUpdate = await canUpdatePost(postId)
    if (!canUpdate) return false
  }

  return true
}

/**
 * Vérifie si l'utilisateur connecté peut effectuer des opérations en bulk de suppression
 */
export const canBulkDeletePosts = async (
  postIds: string[]
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Si l'utilisateur est admin, il peut tout faire
  if (
    userCanOnResource(authUser, ActionsConst.MANAGE, SubjectsConst.POST, {})
  ) {
    return true
  }

  // Sinon, vérifier qu'il peut supprimer tous les posts
  for (const postId of postIds) {
    const canDelete = await canDeletePost(postId)
    if (!canDelete) return false
  }

  return true
}
