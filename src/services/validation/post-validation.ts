import {z} from 'zod'

import {
  CreateCategory,
  CreateHashtag,
  CreatePost,
  CreatePostHashtag,
  CreatePostTranslation,
  POST_STATUS,
  UpdateCategory,
  UpdateHashtag,
  UpdatePost,
  UpdatePostTranslation,
} from '@/services/types/domain/post-types'

import {SUPPORTED_LANGUAGES} from '../types/common-type'

// ===== SCHÉMAS DE BASE =====

export const postUuidSchema = z.string().uuid({
  message: "L'ID du post n'est pas valide.",
})

export const postTranslationUuidSchema = z.string().uuid({
  message: "L'ID de la traduction n'est pas valide.",
})

export const categoryUuidSchema = z.string().uuid({
  message: "L'ID de la catégorie n'est pas valide.",
})

export const hashtagUuidSchema = z.string().uuid({
  message: "L'ID du hashtag n'est pas valide.",
})

export const userUuidSchema = z.string().uuid({
  message: "L'ID de l'utilisateur n'est pas valide.",
})

// ===== SCHÉMAS ENUM =====

export const postStatusSchema = z.enum(
  [POST_STATUS.DRAFT, POST_STATUS.PUBLISHED, POST_STATUS.ARCHIVED],
  {
    message: 'Le statut du post doit être "draft", "published" ou "archived".',
  }
)

export const languageSchema = z.enum(SUPPORTED_LANGUAGES, {
  message: 'La langue doit être "fr", "en" ou "es".',
})

// ===== SCHÉMAS SLUG =====

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Le slug doit contenir uniquement des lettres minuscules, des chiffres et des tirets.',
  })
  .min(1, {
    message: 'Le slug ne peut pas être vide.',
  })
  .max(100, {
    message: 'Le slug ne doit pas contenir plus de 100 caractères.',
  })

// ===== SCHÉMAS COMMUNS =====

const basePostSchema = z.object({
  status: postStatusSchema.optional(),
  authorId: userUuidSchema.optional().nullable(),
  categoryId: categoryUuidSchema.optional().nullable(),
})

const basePostTranslationSchema = z.object({
  language: languageSchema,
  title: z
    .string()
    .min(1, {
      message: 'Le titre ne peut pas être vide.',
    })
    .min(5, {
      message: 'Le titre doit contenir au moins 5 caractères.',
    })
    .max(200, {
      message: 'Le titre ne doit pas contenir plus de 200 caractères.',
    }),
  slug: slugSchema,
  content: z
    .string()
    .min(1, {
      message: 'Le contenu ne peut pas être vide.',
    })
    .min(10, {
      message: 'Le contenu doit contenir au moins 10 caractères.',
    }),
  description: z
    .string()
    .min(1, {
      message: 'La description ne peut pas être vide.',
    })
    .min(10, {
      message: 'La description doit contenir au moins 10 caractères.',
    })
    .max(500, {
      message: 'La description ne doit pas contenir plus de 500 caractères.',
    }),
})

const baseCategorySchema = z.object({
  name: z
    .string()
    .min(1, {
      message: 'Le nom de la catégorie ne peut pas être vide.',
    })
    .min(2, {
      message: 'Le nom de la catégorie doit contenir au moins 2 caractères.',
    })
    .max(50, {
      message:
        'Le nom de la catégorie ne doit pas contenir plus de 50 caractères.',
    }),
  description: z
    .string()
    .min(1, {
      message: 'La description ne peut pas être vide.',
    })
    .max(200, {
      message: 'La description ne doit pas contenir plus de 200 caractères.',
    }),
  icon: z
    .string()
    .max(10, {
      message: "L'icône ne doit pas contenir plus de 10 caractères.",
    })
    .optional()
    .nullable(),
  image: z
    .string()
    .url({
      message: "L'image doit être une URL valide.",
    })
    .optional()
    .nullable(),
})

const baseHashtagSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: 'Le nom du hashtag ne peut pas être vide.',
    })
    .min(2, {
      message: 'Le nom du hashtag doit contenir au moins 2 caractères.',
    })
    .max(30, {
      message: 'Le nom du hashtag ne doit pas contenir plus de 30 caractères.',
    })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message:
        'Le hashtag ne peut contenir que des lettres, chiffres et underscores.',
    }),
})

// ===== SCHÉMAS POST =====

export const createPostServiceSchema =
  basePostSchema satisfies z.Schema<CreatePost>

export const updatePostServiceSchema = z.object({
  id: postUuidSchema,
  status: postStatusSchema.optional(),
  authorId: userUuidSchema.optional().nullable(),
  categoryId: categoryUuidSchema.optional().nullable(),
}) satisfies z.Schema<UpdatePost>

// ===== SCHÉMAS POST TRANSLATION =====

export const createPostTranslationServiceSchema =
  basePostTranslationSchema.extend({
    postId: postUuidSchema,
  }) satisfies z.Schema<CreatePostTranslation>

export const updatePostTranslationServiceSchema = z.object({
  id: postTranslationUuidSchema,
  language: languageSchema.optional(),
  title: z
    .string()
    .min(5, {
      message: 'Le titre doit contenir au moins 5 caractères.',
    })
    .max(200, {
      message: 'Le titre ne doit pas contenir plus de 200 caractères.',
    })
    .optional(),
  slug: slugSchema.optional(),
  content: z
    .string()
    .min(10, {
      message: 'Le contenu doit contenir au moins 10 caractères.',
    })
    .optional(),
  description: z
    .string()
    .min(10, {
      message: 'La description doit contenir au moins 10 caractères.',
    })
    .max(500, {
      message: 'La description ne doit pas contenir plus de 500 caractères.',
    })
    .optional(),
}) satisfies z.Schema<UpdatePostTranslation>

// ===== SCHÉMAS CATEGORY =====

export const createCategoryServiceSchema =
  baseCategorySchema satisfies z.Schema<CreateCategory>

export const updateCategoryServiceSchema = z.object({
  id: categoryUuidSchema,
  name: z
    .string()
    .min(2, {
      message: 'Le nom de la catégorie doit contenir au moins 2 caractères.',
    })
    .max(50, {
      message:
        'Le nom de la catégorie ne doit pas contenir plus de 50 caractères.',
    }),
  description: z.string().max(200, {
    message: 'La description ne doit pas contenir plus de 200 caractères.',
  }),
  icon: z
    .string()
    .max(10, {
      message: "L'icône ne doit pas contenir plus de 10 caractères.",
    })
    .optional()
    .nullable(),
  image: z
    .string()
    .url({
      message: "L'image doit être une URL valide.",
    })
    .optional()
    .nullable(),
}) satisfies z.Schema<UpdateCategory>

// ===== SCHÉMAS HASHTAG =====

export const createHashtagServiceSchema =
  baseHashtagSchema satisfies z.Schema<CreateHashtag>

export const updateHashtagServiceSchema = z.object({
  id: hashtagUuidSchema,
  name: z
    .string()
    .min(2, {
      message: 'Le nom du hashtag doit contenir au moins 2 caractères.',
    })
    .max(30, {
      message: 'Le nom du hashtag ne doit pas contenir plus de 30 caractères.',
    })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message:
        'Le hashtag ne peut contenir que des lettres, chiffres et underscores.',
    })
    .optional(),
}) satisfies z.Schema<UpdateHashtag>

// ===== SCHÉMAS POST HASHTAG =====

export const createPostHashtagServiceSchema = z.object({
  postId: postUuidSchema,
  hashtagId: hashtagUuidSchema,
}) satisfies z.Schema<CreatePostHashtag>

// ===== SCHÉMAS DE FILTRES =====

export const postFiltersSchema = z.object({
  status: postStatusSchema.optional(),
  authorId: userUuidSchema.optional(),
  categoryId: categoryUuidSchema.optional(),
  language: languageSchema.optional(),
  title: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
})

export const categoryFiltersSchema = z.object({
  name: z.string().min(1).optional(),
})

export const hashtagFiltersSchema = z.object({
  name: z.string().min(1).optional(),
})

// ===== SCHÉMAS DE PAGINATION =====

export const paginationSchema = z.object({
  page: z
    .number()
    .int({
      message: 'Le numéro de page doit être un nombre entier.',
    })
    .min(1, {
      message: 'Le numéro de page doit être supérieur à 0.',
    })
    .optional()
    .default(1),
  limit: z
    .number()
    .int({
      message: 'La limite doit être un nombre entier.',
    })
    .min(1, {
      message: 'La limite doit être supérieure à 0.',
    })
    .max(100, {
      message: 'La limite ne peut pas dépasser 100.',
    })
    .optional()
    .default(10),
})

// ===== SCHÉMAS POUR LES OPÉRATIONS COMPLÈTES =====

export const createPostWithTranslationsSchema = z.object({
  post: createPostServiceSchema,
  translations: z.array(basePostTranslationSchema).min(1, {
    message: 'Au moins une traduction est requise.',
  }),
  hashtags: z.array(hashtagUuidSchema).optional(),
})

export const updatePostWithTranslationsSchema = z.object({
  id: postUuidSchema,
  post: updatePostServiceSchema.omit({id: true}).optional(),
  translations: z
    .array(updatePostTranslationServiceSchema.omit({id: true}))
    .optional(),
  hashtags: z.array(hashtagUuidSchema).optional(),
})

// ===== SCHÉMAS POUR LES OPÉRATIONS EN BULK =====

export const postBulkUpdateSchema = z.object({
  ids: z.array(postUuidSchema).min(1, {
    message: 'Au moins un ID de post est requis.',
  }),
  updates: z.object({
    status: postStatusSchema.optional(),
    categoryId: categoryUuidSchema.optional().nullable(),
  }),
})

export const postBulkActionSchema = z.object({
  ids: z.array(postUuidSchema).min(1, {
    message: 'Au moins un ID de post est requis.',
  }),
  action: z.enum(['publish', 'unpublish', 'archive', 'delete'], {
    message:
      'L\'action doit être "publish", "unpublish", "archive" ou "delete".',
  }),
})

// ===== SCHÉMAS POUR LA RECHERCHE =====

export const postSearchSchema = z.object({
  query: z
    .string()
    .min(1, {
      message: 'La requête de recherche ne peut pas être vide.',
    })
    .max(100, {
      message:
        'La requête de recherche ne doit pas contenir plus de 100 caractères.',
    }),
  language: languageSchema.optional(),
  status: postStatusSchema.optional(),
  categoryId: categoryUuidSchema.optional(),
  authorId: userUuidSchema.optional(),
})

// ===== SCHÉMAS POUR LES STATISTIQUES =====

export const postStatsFiltersSchema = z.object({
  authorId: userUuidSchema.optional(),
  categoryId: categoryUuidSchema.optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
})

// ===== SCHÉMAS POUR LES INTERACTIONS =====

export const postInteractionSchema = z.object({
  postId: postUuidSchema,
  action: z.enum(['view', 'like', 'unlike'], {
    message: 'L\'action doit être "view", "like" ou "unlike".',
  }),
})

// ===== SCHÉMAS POUR LA GÉNÉRATION DE SLUG =====

export const generateSlugSchema = z.object({
  title: z.string().min(1, {
    message: 'Le titre ne peut pas être vide.',
  }),
  language: languageSchema,
})

// ===== TYPES EXTRAITS =====

export type PostFiltersInput = z.infer<typeof postFiltersSchema>
export type CategoryFiltersInput = z.infer<typeof categoryFiltersSchema>
export type HashtagFiltersInput = z.infer<typeof hashtagFiltersSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type CreatePostWithTranslationsInput = z.infer<
  typeof createPostWithTranslationsSchema
>
export type UpdatePostWithTranslationsInput = z.infer<
  typeof updatePostWithTranslationsSchema
>
export type PostBulkUpdateInput = z.infer<typeof postBulkUpdateSchema>
export type PostBulkActionInput = z.infer<typeof postBulkActionSchema>
export type PostSearchInput = z.infer<typeof postSearchSchema>
export type PostStatsFiltersInput = z.infer<typeof postStatsFiltersSchema>
export type PostInteractionInput = z.infer<typeof postInteractionSchema>
export type GenerateSlugInput = z.infer<typeof generateSlugSchema>
