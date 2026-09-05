import {and, eq, ilike, inArray, sql} from 'drizzle-orm'

import db from '@/db/models/db'
import {
  AddCategoryModel,
  AddHashtagsModel,
  AddPostHashtagsModel,
  AddPostModel,
  AddPostsTranslationModel,
  categories,
  CategoryModel,
  hashtags,
  HashtagsModel,
  postHashtags,
  PostHashtagsModel,
  PostModel,
  posts,
  postsTranslation,
  PostsTranslationModel,
  UpdateCategoryModel,
  UpdateHashtagModel,
  UpdatePostModel,
} from '@/db/models/post-model'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  CategoryFilters,
  HashtagFilters,
  PostData,
  PostFilters,
} from '@/services/types/domain/post-types'

// ===== CRUD POSTS =====

export const createPostDao = async (post: AddPostModel): Promise<PostModel> => {
  const row = await db.insert(posts).values(post).returning()
  return row[0]
}

export const getPostByIdDao = async (
  postId: string
): Promise<PostModel | undefined> => {
  const row = await db.query.posts.findFirst({
    where: (post, {eq}) => eq(post.id, postId),
  })
  return row
}

export const getPostByIdWithTranslationsDao = async (
  postId: string
): Promise<PostData | undefined> => {
  const row = await db.query.posts.findFirst({
    where: (post, {eq}) => eq(post.id, postId),
    with: {
      postTranslations: true,
    },
  })
  return row
}

export const getPostByIdWithRelationsDao = async (
  postId: string
): Promise<PostData | undefined> => {
  const row = await db.query.posts.findFirst({
    where: (post, {eq}) => eq(post.id, postId),
    with: {
      author: true,
      category: true,
      postTranslations: true,
      postHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  })

  if (!row) return undefined

  // Transform to match PostData type - null to undefined
  return {
    ...row,
    author: row.author || undefined,
    category: row.category || undefined,
  } as PostData
}

export const updatePostByIdDao = async (
  post: UpdatePostModel
): Promise<void> => {
  if (!post.id) {
    throw new Error('Post ID is required')
  }
  await db
    .update(posts)
    .set({...post, updatedAt: new Date()})
    .where(eq(posts.id, post.id))
}

export const deletePostByIdDao = async (postId: string): Promise<void> => {
  await db.delete(posts).where(eq(posts.id, postId))
}

// ===== CRUD POST TRANSLATIONS =====

export const createPostTranslationDao = async (
  translation: AddPostsTranslationModel
): Promise<PostsTranslationModel> => {
  const row = await db.insert(postsTranslation).values(translation).returning()
  return row[0]
}

export const getPostTranslationByIdDao = async (
  translationId: string
): Promise<PostsTranslationModel | undefined> => {
  const row = await db.query.postsTranslation.findFirst({
    where: (translation, {eq}) => eq(translation.id, translationId),
  })
  return row
}

export const getPostTranslationByPostIdAndLanguageDao = async (
  postId: string,
  language: string
): Promise<PostsTranslationModel | undefined> => {
  const row = await db.query.postsTranslation.findFirst({
    where: (translation, {eq, and}) =>
      and(eq(translation.postId, postId), eq(translation.language, language)),
  })
  return row
}

export const getPostTranslationsByPostIdDao = async (
  postId: string
): Promise<PostsTranslationModel[]> => {
  const rows = await db
    .select()
    .from(postsTranslation)
    .where(eq(postsTranslation.postId, postId))
    .orderBy(postsTranslation.language)

  return rows
}

export const updatePostTranslationByIdDao = async (
  translationId: string,
  updates: Partial<Omit<PostsTranslationModel, 'id' | 'postId' | 'createdAt'>>
): Promise<void> => {
  await db
    .update(postsTranslation)
    .set({...updates, updatedAt: new Date()})
    .where(eq(postsTranslation.id, translationId))
}

export const deletePostTranslationByIdDao = async (
  translationId: string
): Promise<void> => {
  await db
    .delete(postsTranslation)
    .where(eq(postsTranslation.id, translationId))
}

// ===== CRUD CATEGORIES =====

export const createCategoryDao = async (
  category: AddCategoryModel
): Promise<CategoryModel> => {
  const row = await db.insert(categories).values(category).returning()
  return row[0]
}

export const getCategoryByIdDao = async (
  categoryId: string
): Promise<CategoryModel | undefined> => {
  const row = await db.query.categories.findFirst({
    where: (category, {eq}) => eq(category.id, categoryId),
  })
  return row
}

export const getCategoryByNameDao = async (
  name: string
): Promise<CategoryModel | undefined> => {
  const row = await db.query.categories.findFirst({
    where: (category, {eq}) => eq(category.name, name),
  })
  return row
}

export const updateCategoryByIdDao = async (
  category: UpdateCategoryModel
): Promise<void> => {
  if (!category.id) {
    throw new Error('Category ID is required')
  }
  await db
    .update(categories)
    .set({...category, updatedAt: new Date()})
    .where(eq(categories.id, category.id))
}

export const deleteCategoryByIdDao = async (
  categoryId: string
): Promise<void> => {
  await db.delete(categories).where(eq(categories.id, categoryId))
}

// ===== CRUD HASHTAGS =====

export const createHashtagDao = async (
  hashtag: AddHashtagsModel
): Promise<HashtagsModel> => {
  const row = await db.insert(hashtags).values(hashtag).returning()
  return row[0]
}

export const getHashtagByIdDao = async (
  hashtagId: string
): Promise<HashtagsModel | undefined> => {
  const row = await db.query.hashtags.findFirst({
    where: (hashtag, {eq}) => eq(hashtag.id, hashtagId),
  })
  return row
}

export const getHashtagByNameDao = async (
  name: string
): Promise<HashtagsModel | undefined> => {
  const row = await db.query.hashtags.findFirst({
    where: (hashtag, {eq}) => eq(hashtag.name, name),
  })
  return row
}

export const updateHashtagByIdDao = async (
  hashtag: UpdateHashtagModel
): Promise<void> => {
  if (!hashtag.id) {
    throw new Error('Hashtag ID is required')
  }
  await db
    .update(hashtags)
    .set({...hashtag, updatedAt: new Date()})
    .where(eq(hashtags.id, hashtag.id))
}

export const deleteHashtagByIdDao = async (
  hashtagId: string
): Promise<void> => {
  await db.delete(hashtags).where(eq(hashtags.id, hashtagId))
}

// ===== CRUD POST HASHTAGS (RELATIONS) =====

export const createPostHashtagDao = async (
  postHashtag: AddPostHashtagsModel
): Promise<PostHashtagsModel> => {
  const row = await db.insert(postHashtags).values(postHashtag).returning()
  return row[0]
}

export const getPostHashtagsByPostIdDao = async (
  postId: string
): Promise<PostHashtagsModel[]> => {
  const rows = await db
    .select()
    .from(postHashtags)
    .where(eq(postHashtags.postId, postId))

  return rows
}

export const deletePostHashtagDao = async (
  postId: string,
  hashtagId: string
): Promise<void> => {
  await db
    .delete(postHashtags)
    .where(
      and(
        eq(postHashtags.postId, postId),
        eq(postHashtags.hashtagId, hashtagId)
      )
    )
}

export const deleteAllPostHashtagsByPostIdDao = async (
  postId: string
): Promise<void> => {
  await db.delete(postHashtags).where(eq(postHashtags.postId, postId))
}

export const upsertPostHashtags = async (
  postId: string,
  existingHashtagIds: string[] = [],
  newHashtagNames: string[] = []
): Promise<void> => {
  await db.transaction(async (tx) => {
    // 1. Supprimer toutes les associations existantes
    await tx.delete(postHashtags).where(eq(postHashtags.postId, postId))

    // 2. Associer les hashtags existants
    for (const hashtagId of existingHashtagIds) {
      // Vérifier que le hashtag existe
      const existingHashtag = await tx.query.hashtags.findFirst({
        where: (hashtag, {eq}) => eq(hashtag.id, hashtagId),
      })

      if (!existingHashtag) {
        throw new Error(`Hashtag avec l'ID ${hashtagId} non trouvé`)
      }

      // Créer l'association
      await tx.insert(postHashtags).values({
        postId,
        hashtagId,
      })
    }

    // 3. Créer et associer les nouveaux hashtags
    for (const hashtagName of newHashtagNames) {
      const sanitizedName = hashtagName.trim()
      if (!sanitizedName) continue

      // Chercher si le hashtag existe déjà
      let hashtag = await tx.query.hashtags.findFirst({
        where: (h, {eq}) => eq(h.name, sanitizedName),
      })

      // Créer le hashtag s'il n'existe pas
      if (!hashtag) {
        const newHashtag = await tx
          .insert(hashtags)
          .values({name: sanitizedName})
          .returning()
        hashtag = newHashtag[0]
      }

      // Créer l'association
      await tx.insert(postHashtags).values({
        postId,
        hashtagId: hashtag.id,
      })
    }
  })
}

// ===== REQUÊTES POSTS AVEC PAGINATION =====

export const getPostsWithPaginationDao = async (
  pagination: Pagination,
  filters?: PostFilters
): Promise<PaginatedResponse<PostModel>> => {
  const whereConditions = []

  if (filters?.status) {
    whereConditions.push(
      eq(posts.status, filters.status as 'draft' | 'published' | 'archived')
    )
  }
  if (filters?.authorId) {
    whereConditions.push(eq(posts.authorId, filters.authorId))
  }
  if (filters?.categoryId) {
    whereConditions.push(eq(posts.categoryId, filters.categoryId))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(whereClause)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(posts.createdAt),
    db
      .select({count: sql<number>`count(*)`})
      .from(posts)
      .where(whereClause),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const getPostsWithTranslationsAndPaginationDao = async (
  pagination: Pagination,
  language: string,
  filters?: PostFilters
): Promise<PaginatedResponse<PostData>> => {
  const whereConditions = []

  if (filters?.status) {
    whereConditions.push(
      eq(posts.status, filters.status as 'draft' | 'published' | 'archived')
    )
  }
  if (filters?.authorId) {
    whereConditions.push(eq(posts.authorId, filters.authorId))
  }
  if (filters?.categoryId) {
    whereConditions.push(eq(posts.categoryId, filters.categoryId))
  }

  // Pour la recherche par titre, on doit utiliser un JOIN
  if (filters?.title) {
    const postsWithTitle = await db
      .select({postId: postsTranslation.postId})
      .from(postsTranslation)
      .where(ilike(postsTranslation.title, `%${filters.title}%`))

    const postIds = postsWithTitle.map((p) => p.postId)
    if (postIds.length > 0) {
      whereConditions.push(inArray(posts.id, postIds))
    } else {
      // Si aucun post trouvé par titre, retourner vide
      return {
        data: [],
        pagination: {
          total: 0,
          page: Math.max(
            1,
            Math.ceil(pagination.offset / pagination.limit) + 1
          ),
          limit: pagination.limit,
          totalPages: 0,
        },
      }
    }
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined

  const [rows, [{count}]] = await Promise.all([
    db.query.posts.findMany({
      where: whereClause,
      with: {
        author: true,
        category: true,
        postTranslations: {
          where: (translation, {eq}) => eq(translation.language, language),
        },
        postHashtags: {
          with: {
            hashtag: true,
          },
        },
      },
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: (posts, {desc}) => [desc(posts.createdAt)],
    }),
    db
      .select({count: sql<number>`count(*)`})
      .from(posts)
      .where(whereClause),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data:
      rows.length === 0
        ? []
        : rows.map(
            (row) =>
              ({
                ...row,
                author: row.author || undefined,
                category: row.category || undefined,
              }) as PostData
          ),
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

// ===== REQUÊTES SPÉCIFIQUES POSTS =====

export const getPostsByAuthorIdDao = async (
  authorId: string
): Promise<PostModel[]> => {
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(posts.createdAt)

  return rows
}

export const getPostsByStatusDao = async (
  status: string
): Promise<PostModel[]> => {
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.status, status as 'draft' | 'published' | 'archived'))
    .orderBy(posts.createdAt)

  return rows
}

export const getPostsByCategoryIdDao = async (
  categoryId: string
): Promise<PostModel[]> => {
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.categoryId, categoryId))
    .orderBy(posts.createdAt)

  return rows
}

export const getPostBySlugAndLanguageDao = async (
  slug: string,
  language: string
): Promise<PostData | undefined> => {
  const translation = await db.query.postsTranslation.findFirst({
    where: (translation, {eq, and}) =>
      and(eq(translation.slug, slug), eq(translation.language, language)),
    with: {
      post: {
        with: {
          author: true,
          category: true,
          postTranslations: true,
          postHashtags: {
            with: {
              hashtag: true,
            },
          },
        },
      },
    },
  })

  if (!translation?.post) return undefined

  return {
    ...translation.post,
    author: translation.post.author || undefined,
    category: translation.post.category || undefined,
  } as PostData
}

export const getAllPublishedPostSlugsDao = async (): Promise<
  {slug: string; language: string}[]
> => {
  const translations = await db
    .select({
      slug: postsTranslation.slug,
      language: postsTranslation.language,
    })
    .from(postsTranslation)
    .innerJoin(posts, eq(postsTranslation.postId, posts.id))
    .where(eq(posts.status, 'published'))

  return translations
}

export const getPublishedPostBySlugDao = async (
  slug: string
): Promise<PostData | undefined> => {
  const translation = await db.query.postsTranslation.findFirst({
    where: (translation, {eq}) => eq(translation.slug, slug),
    with: {
      post: {
        with: {
          author: true,
          category: true,
          postTranslations: true,
          postHashtags: {
            with: {
              hashtag: true,
            },
          },
        },
      },
    },
  })

  if (!translation?.post) return undefined

  // Vérifier que le post est publié
  if (translation.post.status !== 'published') return undefined

  return {
    ...translation.post,
    author: translation.post.author || undefined,
    category: translation.post.category || undefined,
  } as PostData
}

// ===== REQUÊTES CATEGORIES AVEC PAGINATION =====

export const getCategoriesWithPaginationDao = async (
  pagination: Pagination,
  filters?: CategoryFilters
): Promise<PaginatedResponse<CategoryModel>> => {
  const whereConditions = []

  if (filters?.name) {
    whereConditions.push(ilike(categories.name, `%${filters.name}%`))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(whereClause)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(categories.name),
    db
      .select({count: sql<number>`count(*)`})
      .from(categories)
      .where(whereClause),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const getAllCategoriesDao = async (): Promise<CategoryModel[]> => {
  const rows = await db.select().from(categories).orderBy(categories.name)
  return rows
}

// ===== REQUÊTES HASHTAGS AVEC PAGINATION =====

export const getHashtagsWithPaginationDao = async (
  pagination: Pagination,
  filters?: HashtagFilters
): Promise<PaginatedResponse<HashtagsModel>> => {
  const whereConditions = []

  if (filters?.name) {
    whereConditions.push(ilike(hashtags.name, `%${filters.name}%`))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(hashtags)
      .where(whereClause)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(hashtags.name),
    db
      .select({count: sql<number>`count(*)`})
      .from(hashtags)
      .where(whereClause),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const getAllHashtagsDao = async (): Promise<HashtagsModel[]> => {
  const rows = await db.select().from(hashtags).orderBy(hashtags.name)
  return rows
}

// ===== FONCTIONS POUR LES STATISTIQUES =====

export const getPostStatsDao = async (): Promise<{
  totalPosts: number
  publishedPosts: number
  draftPosts: number
  archivedPosts: number
}> => {
  const [stats] = await db
    .select({
      totalPosts: sql<number>`count(*)`,
      publishedPosts: sql<number>`count(*) filter (where status = 'published')`,
      draftPosts: sql<number>`count(*) filter (where status = 'draft')`,
      archivedPosts: sql<number>`count(*) filter (where status = 'archived')`,
    })
    .from(posts)

  return stats
}

export const incrementPostLikeDao = async (postId: string): Promise<void> => {
  await db
    .update(posts)
    .set({nbLike: sql`${posts.nbLike} + 1`})
    .where(eq(posts.id, postId))
}

export const decrementPostLikeDao = async (postId: string): Promise<void> => {
  await db
    .update(posts)
    .set({nbLike: sql`${posts.nbLike} - 1`})
    .where(eq(posts.id, postId))
}

export const incrementPostViewDao = async (postId: string): Promise<void> => {
  await db
    .update(posts)
    .set({nbView: sql`${posts.nbView} + 1`})
    .where(eq(posts.id, postId))
}

// ===== FONCTIONS POUR LES OPÉRATIONS EN BULK =====

export const updatePostsStatusDao = async (
  postIds: string[],
  status: string
): Promise<void> => {
  if (postIds.length === 0) return

  await db
    .update(posts)
    .set({
      status: status as 'draft' | 'published' | 'archived',
      updatedAt: new Date(),
    })
    .where(inArray(posts.id, postIds))
}

export const deletePostsDao = async (postIds: string[]): Promise<void> => {
  if (postIds.length === 0) return

  await db.transaction(async (tx) => {
    // Supprimer les relations hashtags
    await tx.delete(postHashtags).where(inArray(postHashtags.postId, postIds))

    // Supprimer les traductions
    await tx
      .delete(postsTranslation)
      .where(inArray(postsTranslation.postId, postIds))

    // Supprimer les posts
    await tx.delete(posts).where(inArray(posts.id, postIds))
  })
}

// ===== FONCTIONS UTILITAIRES =====

export const updatePostHashtagsDao = async (
  postId: string,
  hashtagIds: string[]
): Promise<void> => {
  await db.transaction(async (tx) => {
    // Supprimer tous les hashtags existants pour ce post
    await tx.delete(postHashtags).where(eq(postHashtags.postId, postId))

    // Ajouter les nouveaux hashtags
    if (hashtagIds.length > 0) {
      const newPostHashtags = hashtagIds.map((hashtagId) => ({
        postId,
        hashtagId,
      }))
      await tx.insert(postHashtags).values(newPostHashtags)
    }
  })
}
