import {ZodError} from 'zod'

import {
  createCategoryDao,
  createHashtagDao,
  createPostDao,
  createPostTranslationDao,
  deleteCategoryByIdDao,
  deletePostsDao,
  deletePostTranslationByIdDao,
  getAllCategoriesDao,
  getAllHashtagsDao,
  getAllPublishedPostSlugsDao,
  getCategoryByIdDao,
  getCategoryByNameDao,
  getHashtagByIdDao,
  getHashtagByNameDao,
  getPostByIdDao,
  getPostByIdWithRelationsDao,
  getPostByIdWithTranslationsDao,
  getPostBySlugAndLanguageDao,
  getPostsByCategoryIdDao,
  getPostStatsDao,
  getPostsWithPaginationDao,
  getPostsWithTranslationsAndPaginationDao,
  getPostTranslationByIdDao,
  getPostTranslationByPostIdAndLanguageDao,
  getPostTranslationsByPostIdDao,
  getPublishedPostBySlugDao,
  incrementPostLikeDao,
  incrementPostViewDao,
  updateCategoryByIdDao,
  updatePostByIdDao,
  updatePostsStatusDao,
  updatePostTranslationByIdDao,
  upsertPostHashtags,
} from '@/db/repositories/post-repository'

import {getAuthUser} from './authentication/auth-service'
import {
  canArchivePost,
  canBulkDeletePosts,
  canBulkUpdatePosts,
  canCreateCategory,
  canCreateHashtag,
  canCreatePost,
  canCreatePostTranslation,
  canDeleteCategory,
  canDeletePost,
  canDeletePostTranslation,
  canPublishPost,
  canReadAllCategories,
  canReadAllHashtags,
  canReadAllPosts,
  canReadCategory,
  canReadHashtag,
  canReadPost,
  canReadPostTranslation,
  canUnpublishPost,
  canUpdateCategory,
  canUpdatePost,
  canUpdatePostTranslation,
} from './authorization/post-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {createTypedNotificationService} from './facades/notification-service-facade'
import {Pagination, SUPPORTED_LANGUAGES} from './types/common-type'
import {NotificationTypeConst} from './types/domain/notification-types'
import {
  CategoryDTO,
  CreateCategory,
  CreateHashtag,
  CreatePost,
  CreatePostTranslation,
  POST_STATUS,
  PostBulkAction,
  PostBulkUpdate,
  PostData,
  PostFilters,
  SupportedLanguage,
  UpdateCategory,
  UpdatePost,
  UpdatePostTranslation,
} from './types/domain/post-types'
import {
  categoryUuidSchema,
  createCategoryServiceSchema,
  createHashtagServiceSchema,
  createPostServiceSchema,
  createPostTranslationServiceSchema,
  generateSlugSchema,
  hashtagUuidSchema,
  postBulkActionSchema,
  postBulkUpdateSchema,
  postFiltersSchema,
  postUuidSchema,
  updateCategoryServiceSchema,
  updatePostServiceSchema,
  updatePostTranslationServiceSchema,
} from './validation/post-validation'

// ===== SERVICES POST =====

/**
 * Créer un nouveau post
 */
export const createPostService = async (postData: CreatePost) => {
  // Validation des données
  const parsed = createPostServiceSchema.safeParse(postData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canCreatePost()
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupérer l'utilisateur actuel pour définir l'auteur si non spécifié
  const authUser = await getAuthUser()
  if (!validatedData.authorId && authUser) {
    validatedData.authorId = authUser.id
  }

  // Création du post
  const post = await createPostDao(validatedData)

  // Notification
  if (authUser) {
    await createTypedNotificationService({
      userId: authUser.id,
      type: NotificationTypeConst.project_created, // Réutilise temporairement ce type
      metadata: {
        projectId: post.id, // Utilise projectId pour correspondre au type existant
        projectName: `Post ${post.id}`,
      },
    })
  }

  return post
}

/**
 * Récupérer un post par ID
 */
export const getPostByIdService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canReadPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const post = await getPostByIdDao(parsed.data)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  return post
}

/**
 * Récupérer un post par ID avec toutes ses relations
 */
export const getPostByIdWithRelationsService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canReadPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const post = await getPostByIdWithRelationsDao(parsed.data)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  return post
}

/**
 * Récupérer un post par slug et langue
 */
export const getPostBySlugAndLanguageService = async (
  slug: string,
  language: SupportedLanguage
) => {
  // Validation basique
  if (!slug || !language) {
    throw new ValidationError('Slug et langue sont requis')
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new ValidationError('Langue non supportée')
  }

  const post = await getPostBySlugAndLanguageDao(slug, language)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  // Vérification des autorisations
  const granted = await canReadPost(post.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Incrémenter les vues pour les posts publiés
  if (post.status === POST_STATUS.PUBLISHED) {
    await incrementPostViewDao(post.id)
  }

  return post
}

/**
 * Mettre à jour un post
 */
export const updatePostService = async (postData: UpdatePost) => {
  // Validation
  const parsed = updatePostServiceSchema.safeParse(postData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canUpdatePost(validatedData.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que le post existe
  const existingPost = await getPostByIdDao(validatedData.id)
  if (!existingPost) {
    throw new NotFoundError('Post non trouvé')
  }

  // Mise à jour
  await updatePostByIdDao(validatedData)

  return await getPostByIdDao(validatedData.id)
}

/**
 * Supprimer un post
 */
export const deletePostService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canDeletePost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que le post existe
  const existingPost = await getPostByIdDao(parsed.data)
  if (!existingPost) {
    throw new NotFoundError('Post non trouvé')
  }

  // Suppression (cascade : traductions et hashtags)
  await deletePostsDao([parsed.data])

  return true
}

/**
 * Publier un post
 */
export const publishPostService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canPublishPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Mettre à jour le statut
  await updatePostByIdDao({
    id: parsed.data,
    status: POST_STATUS.PUBLISHED,
  })

  return await getPostByIdDao(parsed.data)
}

/**
 * Dépublier un post
 */
export const unpublishPostService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canUnpublishPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Mettre à jour le statut
  await updatePostByIdDao({
    id: parsed.data,
    status: POST_STATUS.DRAFT,
  })

  return await getPostByIdDao(parsed.data)
}

/**
 * Archiver un post
 */
export const archivePostService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canArchivePost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Mettre à jour le statut
  await updatePostByIdDao({
    id: parsed.data,
    status: POST_STATUS.ARCHIVED,
  })

  return await getPostByIdDao(parsed.data)
}

// ===== SERVICES POST TRANSLATION =====

/**
 * Créer une traduction pour un post
 */
export const createPostTranslationService = async (
  translationData: CreatePostTranslation
) => {
  // Validation
  const parsed = createPostTranslationServiceSchema.safeParse(translationData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canCreatePostTranslation(validatedData.postId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que le post existe
  const existingPost = await getPostByIdDao(validatedData.postId)
  if (!existingPost) {
    throw new NotFoundError('Post non trouvé')
  }

  // Vérifier qu'une traduction dans cette langue n'existe pas déjà
  const existingTranslation = await getPostTranslationByPostIdAndLanguageDao(
    validatedData.postId,
    validatedData.language
  )
  if (existingTranslation) {
    throw new ValidationError(
      `Une traduction en ${validatedData.language} existe déjà pour ce post`
    )
  }

  // Création
  const translation = await createPostTranslationDao(validatedData)

  return translation
}

/**
 * Récupérer une traduction par ID
 */
export const getPostTranslationByIdService = async (translationId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(translationId) // Réutilise le même schéma UUID
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canReadPostTranslation(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const translation = await getPostTranslationByIdDao(parsed.data)
  if (!translation) {
    throw new NotFoundError('Traduction non trouvée')
  }

  return translation
}

/**
 * Récupérer toutes les traductions d'un post
 */
export const getPostTranslationsByPostIdService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canReadPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const translations = await getPostTranslationsByPostIdDao(parsed.data)

  return translations
}

/**
 * Mettre à jour une traduction
 */
export const updatePostTranslationService = async (
  translationData: UpdatePostTranslation
) => {
  // Validation
  const parsed = updatePostTranslationServiceSchema.safeParse(translationData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canUpdatePostTranslation(validatedData.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que la traduction existe
  const existingTranslation = await getPostTranslationByIdDao(validatedData.id)
  if (!existingTranslation) {
    throw new NotFoundError('Traduction non trouvée')
  }

  // Mise à jour
  await updatePostTranslationByIdDao(validatedData.id, validatedData)

  return await getPostTranslationByIdDao(validatedData.id)
}

/**
 * Supprimer une traduction
 */
export const deletePostTranslationService = async (translationId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(translationId) // Réutilise le même schéma UUID
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canDeletePostTranslation(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que la traduction existe
  const existingTranslation = await getPostTranslationByIdDao(parsed.data)
  if (!existingTranslation) {
    throw new NotFoundError('Traduction non trouvée')
  }

  // Suppression
  await deletePostTranslationByIdDao(parsed.data)

  return true
}

// ===== SERVICES CATEGORY =====

/**
 * Créer une nouvelle catégorie
 */
export const createCategoryService = async (categoryData: CreateCategory) => {
  // Validation
  const parsed = createCategoryServiceSchema.safeParse(categoryData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canCreateCategory()
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que le nom n'existe pas déjà
  const existingCategory = await getCategoryByNameDao(validatedData.name)
  if (existingCategory) {
    throw new ValidationError('Une catégorie avec ce nom existe déjà')
  }

  // Création
  const category = await createCategoryDao(validatedData)

  return category
}

/**
 * Récupérer une catégorie par ID
 */
export const getCategoryByIdService = async (categoryId: string) => {
  // Validation
  const parsed = categoryUuidSchema.safeParse(categoryId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canReadCategory(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const category = await getCategoryByIdDao(parsed.data)
  if (!category) {
    throw new NotFoundError('Catégorie non trouvée')
  }

  return category
}

/**
 * Récupérer toutes les catégories
 */
export const getAllCategoriesService = async () => {
  // Vérification des autorisations
  const granted = await canReadAllCategories()
  if (!granted) {
    throw new AuthorizationError()
  }

  const categories = await getAllCategoriesDao()

  return categories
}

/**
 * Récupérer toutes les catégories
 * (public =  no auth, no permission, no Dynamic server usage error)
 */
export const getAllCategoriesPublicService = async (): Promise<
  CategoryDTO[]
> => {
  const categories = await getAllCategoriesDao()
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    icon: category.icon,
    image: category.image,
  }))
}
/**
 * Mettre à jour une catégorie
 */
export const updateCategoryService = async (categoryData: UpdateCategory) => {
  // Validation
  const parsed = updateCategoryServiceSchema.safeParse(categoryData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canUpdateCategory(validatedData.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que la catégorie existe
  const existingCategory = await getCategoryByIdDao(validatedData.id)
  if (!existingCategory) {
    throw new NotFoundError('Catégorie non trouvée')
  }

  // Vérifier l'unicité du nom si modifié
  if (validatedData.name && validatedData.name !== existingCategory.name) {
    const duplicateCategory = await getCategoryByNameDao(validatedData.name)
    if (duplicateCategory) {
      throw new ValidationError('Une catégorie avec ce nom existe déjà')
    }
  }

  // Mise à jour
  await updateCategoryByIdDao(validatedData)

  return await getCategoryByIdDao(validatedData.id)
}

/**
 * Supprimer une catégorie
 */
export const deleteCategoryService = async (categoryId: string) => {
  // Validation
  const parsed = categoryUuidSchema.safeParse(categoryId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canDeleteCategory(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que la catégorie existe
  const existingCategory = await getCategoryByIdDao(parsed.data)
  if (!existingCategory) {
    throw new NotFoundError('Catégorie non trouvée')
  }

  // Vérifier qu'aucun post n'utilise cette catégorie
  const postsUsingCategory = await getPostsByCategoryIdDao(parsed.data)
  if (postsUsingCategory.length > 0) {
    throw new ValidationError(
      'Impossible de supprimer une catégorie utilisée par des posts'
    )
  }

  // Suppression
  await deleteCategoryByIdDao(parsed.data)

  return true
}

// ===== SERVICES HASHTAG =====

/**
 * Créer un nouveau hashtag
 */
export const createHashtagService = async (hashtagData: CreateHashtag) => {
  // Validation
  const parsed = createHashtagServiceSchema.safeParse(hashtagData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canCreateHashtag()
  if (!granted) {
    throw new AuthorizationError()
  }

  // Vérifier que le nom n'existe pas déjà
  const existingHashtag = await getHashtagByNameDao(validatedData.name)
  if (existingHashtag) {
    return existingHashtag // Retourne le hashtag existant plutôt qu'une erreur
  }

  // Création
  const hashtag = await createHashtagDao(validatedData)

  return hashtag
}

/**
 * Récupérer un hashtag par ID
 */
export const getHashtagByIdService = async (hashtagId: string) => {
  // Validation
  const parsed = hashtagUuidSchema.safeParse(hashtagId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérification des autorisations
  const granted = await canReadHashtag(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const hashtag = await getHashtagByIdDao(parsed.data)
  if (!hashtag) {
    throw new NotFoundError('Hashtag non trouvé')
  }

  return hashtag
}

/**
 * Récupérer tous les hashtags
 */
export const getAllHashtagsService = async () => {
  // Vérification des autorisations
  const granted = await canReadAllHashtags()
  if (!granted) {
    throw new AuthorizationError()
  }

  const hashtags = await getAllHashtagsDao()

  return hashtags
}

// ===== SERVICES DE RECHERCHE ET PAGINATION =====

/**
 * Récupérer les posts avec pagination
 */
export const getPostsWithPaginationService = async (
  pagination: Pagination,
  filters?: PostFilters
) => {
  // Validation des filtres
  if (filters) {
    const parsed = postFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }
  }

  // Vérification des autorisations
  const granted = await canReadAllPosts()
  if (!granted) {
    throw new AuthorizationError()
  }

  const posts = await getPostsWithPaginationDao(pagination, filters)

  return posts
}

/**
 * Récupérer les posts avec traductions et pagination
 */
export const getPostsWithTranslationsAndPaginationService = async (
  pagination: Pagination,
  language: SupportedLanguage,
  filters?: PostFilters
) => {
  // Validation des filtres
  if (filters) {
    const parsed = postFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new ValidationError('Langue non supportée')
  }

  // Vérification des autorisations
  const granted = await canReadAllPosts()
  if (!granted) {
    throw new AuthorizationError()
  }

  const posts = await getPostsWithTranslationsAndPaginationDao(
    pagination,
    language,
    filters
  )

  return posts
}

/**
 * Générer un slug à partir d'un titre
 */
export const generateSlugService = async (
  title: string,
  language: SupportedLanguage
) => {
  // Validation
  const parsed = generateSlugSchema.safeParse({title, language})
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Générer le slug de base
  let baseSlug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9\s-]/g, '') // Garder seulement lettres, chiffres, espaces et tirets
    .replace(/\s+/g, '-') // Remplacer espaces par tirets
    .replace(/-+/g, '-') // Fusionner tirets multiples
    .replace(/^-|-$/g, '') // Supprimer tirets début/fin

  // S'assurer que le slug n'est pas vide
  if (!baseSlug) {
    baseSlug = 'post'
  }

  // TODO: Vérifier unicité et ajouter suffixe si nécessaire
  // Pour l'instant, on retourne le slug de base
  return baseSlug
}

// ===== SERVICES D'INTERACTION =====

/**
 * Liker un post
 */
export const likePostService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérifier que le post existe et est lisible
  const granted = await canReadPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const post = await getPostByIdDao(parsed.data)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  // Incrémenter les likes (seulement pour les posts publiés)
  if (post.status === POST_STATUS.PUBLISHED) {
    await incrementPostLikeDao(parsed.data)
  }

  return await getPostByIdWithTranslationsDao(parsed.data)
}

/**
 * Incrémenter les vues d'un post
 */
export const incrementViewPostService = async (postId: string) => {
  // Validation
  const parsed = postUuidSchema.safeParse(postId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  // Vérifier que le post existe et est lisible
  const granted = await canReadPost(parsed.data)
  if (!granted) {
    throw new AuthorizationError()
  }

  const post = await getPostByIdDao(parsed.data)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  // Incrémenter les vues (seulement pour les posts publiés)
  if (post.status === POST_STATUS.PUBLISHED) {
    await incrementPostViewDao(parsed.data)
  }

  return await getPostByIdWithTranslationsDao(parsed.data)
}

// ===== SERVICES BULK OPERATIONS =====

/**
 * Mettre à jour plusieurs posts en lot
 */
export const bulkUpdatePostsService = async (bulkData: PostBulkUpdate) => {
  // Validation
  const parsed = postBulkUpdateSchema.safeParse(bulkData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations pour tous les posts
  const granted = await canBulkUpdatePosts(validatedData.ids)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Mise à jour en lot
  if (validatedData.updates.status) {
    await updatePostsStatusDao(validatedData.ids, validatedData.updates.status)
  }

  return true
}

/**
 * Actions en lot sur les posts
 */
export const bulkActionPostsService = async (bulkData: PostBulkAction) => {
  // Validation
  const parsed = postBulkActionSchema.safeParse(bulkData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  switch (validatedData.action) {
    case 'publish':
      // Vérifier autorisations et publier
      for (const postId of validatedData.ids) {
        const canPublish = await canPublishPost(postId)
        if (!canPublish) {
          throw new AuthorizationError(
            `Impossible de publier le post ${postId}`
          )
        }
      }
      await updatePostsStatusDao(validatedData.ids, POST_STATUS.PUBLISHED)
      break

    case 'unpublish':
      // Vérifier autorisations et dépublier
      for (const postId of validatedData.ids) {
        const canUnpublish = await canUnpublishPost(postId)
        if (!canUnpublish) {
          throw new AuthorizationError(
            `Impossible de dépublier le post ${postId}`
          )
        }
      }
      await updatePostsStatusDao(validatedData.ids, POST_STATUS.DRAFT)
      break

    case 'archive':
      // Vérifier autorisations et archiver
      for (const postId of validatedData.ids) {
        const canArchive = await canArchivePost(postId)
        if (!canArchive) {
          throw new AuthorizationError(
            `Impossible d'archiver le post ${postId}`
          )
        }
      }
      await updatePostsStatusDao(validatedData.ids, POST_STATUS.ARCHIVED)
      break

    case 'delete': {
      // Vérifier autorisations et supprimer
      const granted = await canBulkDeletePosts(validatedData.ids)
      if (!granted) {
        throw new AuthorizationError()
      }
      await deletePostsDao(validatedData.ids)
      break
    }

    default:
      throw new ValidationError('Action non supportée')
  }

  return true
}

// ===== SERVICES DE STATISTIQUES =====

/**
 * Récupérer les statistiques des posts
 */
export const getPostStatsService = async () => {
  // Vérification des autorisations (admin seulement)
  const granted = await canReadAllPosts()
  if (!granted) {
    throw new AuthorizationError()
  }

  const stats = await getPostStatsDao()

  return stats
}

// ===== SERVICES PUBLICS (SANS AUTORISATION) =====

/**
 * Récupérer les posts publiés avec traductions et pagination (VERSION PUBLIQUE)
 */
export const getPublishedPostsWithTranslationsService = async (
  pagination: Pagination,
  language: SupportedLanguage,
  filters?: PostFilters
) => {
  // Validation des filtres
  if (filters) {
    const parsed = postFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new ValidationError('Langue non supportée')
  }

  // Forcer le filtre sur les posts publiés seulement
  const publicFilters = {
    ...filters,
    status: POST_STATUS.PUBLISHED,
  }

  const posts = await getPostsWithTranslationsAndPaginationDao(
    pagination,
    language,
    publicFilters
  )

  return posts
}

/**
 * Récupérer un post publié par slug et langue (VERSION PUBLIQUE)
 */
export const getPublishedPostBySlugAndLanguageService = async (
  slug: string,
  language: SupportedLanguage
): Promise<PostData> => {
  // Validation basique
  if (!slug || !language) {
    throw new ValidationError('Slug et langue sont requis')
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new ValidationError('Langue non supportée')
  }

  const post = await getPostBySlugAndLanguageDao(slug, language)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  // Vérifier que le post est publié
  if (post.status !== POST_STATUS.PUBLISHED) {
    throw new NotFoundError('Post non trouvé')
  }

  // Incrémenter les vues pour les posts publiés
  // await incrementPostViewDao(post.id) //Fait coté client

  return post
}

/**
 * Récupérer tous les slugs des posts publiés (VERSION PUBLIQUE)
 */
export const getAllPublishedPostSlugsService = async (): Promise<
  {slug: string; language: string}[]
> => {
  return await getAllPublishedPostSlugsDao()
}

/**
 * Récupérer un post publié par slug (VERSION PUBLIQUE)
 */
export const getPublishedPostBySlugService = async (
  slug: string
): Promise<PostData> => {
  // Validation basique
  if (!slug) {
    throw new ValidationError('Slug est requis')
  }

  const post = await getPublishedPostBySlugDao(slug)
  if (!post) {
    throw new NotFoundError('Post non trouvé')
  }

  // Incrémenter les vues pour les posts publiés
  // await incrementPostViewDao(post.id) //Fait coté client

  return post
}

// ===== SERVICES COMPLEXES =====

/**
 * Créer un post avec traductions et hashtags
 */
export const createPostWithTranslationsService = async (
  postData: CreatePost,
  translations: CreatePostTranslation[],
  hashtags: string[] = [],
  newHashtags: string[] = []
) => {
  // Validation du post
  const parsedPost = createPostServiceSchema.safeParse(postData)
  if (!parsedPost.success) {
    throw new ValidationParsedZodError(parsedPost.error)
  }

  // Vérification des autorisations
  const canCreate = await canCreatePost()
  if (!canCreate) {
    throw new AuthorizationError()
  }

  // 1. Créer le post
  const createdPost = await createPostDao(parsedPost.data)

  try {
    // 2. Créer les traductions
    for (const [index, translation] of translations.entries()) {
      const translationData = {
        ...translation,
        postId: createdPost.id,
      }

      const parsedTranslation =
        createPostTranslationServiceSchema.safeParse(translationData)
      if (!parsedTranslation.success) {
        // Créer une nouvelle ZodError avec les chemins modifiés
        const modifiedErrors = parsedTranslation.error.issues.map((err) => ({
          ...err,
          path: [index.toString(), ...err.path],
        }))

        const modifiedZodError = new ZodError(modifiedErrors)
        throw new ValidationParsedZodError(modifiedZodError)
      }

      await createPostTranslationDao(parsedTranslation.data)
    }

    // 3. Gérer les hashtags (existants et nouveaux)
    await upsertPostHashtags(createdPost.id, hashtags, newHashtags)

    return await getPostByIdWithRelationsDao(createdPost.id)
  } catch (error) {
    // En cas d'erreur, supprimer le post créé
    await deletePostsDao([createdPost.id])
    throw error
  }
}

/**
 * Mettre à jour un post avec traductions et hashtags
 */
export const updatePostWithTranslationsService = async (
  postData: UpdatePost,
  translations: CreatePostTranslation[],
  hashtags: string[] = [],
  newHashtags: string[] = []
) => {
  // Validation du post
  const parsedPost = updatePostServiceSchema.safeParse(postData)
  if (!parsedPost.success) {
    throw new ValidationParsedZodError(parsedPost.error)
  }

  // Vérification des autorisations
  const canUpdate = await canUpdatePost(parsedPost.data.id)
  if (!canUpdate) {
    throw new AuthorizationError()
  }

  // Vérifier que le post existe
  const existingPost = await getPostByIdDao(parsedPost.data.id)
  if (!existingPost) {
    throw new NotFoundError('Post non trouvé')
  }

  // 1. Mettre à jour le post
  await updatePostByIdDao(parsedPost.data)

  // 2. Supprimer les anciennes traductions
  const existingTranslations = await getPostTranslationsByPostIdDao(
    parsedPost.data.id
  )
  for (const translation of existingTranslations) {
    await deletePostTranslationByIdDao(translation.id)
  }

  // 3. Créer les nouvelles traductions
  for (const [index, translation] of translations.entries()) {
    const translationData = {
      ...translation,
      postId: parsedPost.data.id,
    }

    const parsedTranslation =
      createPostTranslationServiceSchema.safeParse(translationData)
    if (!parsedTranslation.success) {
      // Créer une nouvelle ZodError avec les chemins modifiés
      const modifiedErrors = parsedTranslation.error.issues.map((err) => ({
        ...err,
        path: [index.toString(), ...err.path],
      }))

      const modifiedZodError = new ZodError(modifiedErrors)
      throw new ValidationParsedZodError(modifiedZodError)
    }

    await createPostTranslationDao(parsedTranslation.data)
  }

  // 4. Gérer les hashtags (existants et nouveaux)
  await upsertPostHashtags(parsedPost.data.id, hashtags, newHashtags)

  return await getPostByIdWithRelationsDao(parsedPost.data.id)
}
