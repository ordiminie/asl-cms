import {
  AddCategoryModel,
  AddHashtagsModel,
  AddPostHashtagsModel,
  AddPostModel,
  AddPostsTranslationModel,
  CategoryModel,
  HashtagsModel,
  PostHashtagsModel,
  PostModel,
  PostsTranslationModel,
  UpdateCategoryModel,
  UpdateHashtagModel,
  UpdatePostModel,
} from '@/db/models/post-model'
import {UserModel} from '@/db/models/user-model'

import {SUPPORTED_LANGUAGES} from '../common-type'

// ===== TYPES DE DOMAINE DÉCOUPLÉS =====

// Re-export des types de modèles pour utilisation externe
export type {PostModel} from '@/db/models/post-model'

// Types de domaine découplés des types Drizzle
export type Post = PostModel
export type PostTranslation = PostsTranslationModel
export type Category = CategoryModel
export type Hashtag = HashtagsModel
export type PostHashtag = PostHashtagsModel

// ===== TYPES POUR LES OPÉRATIONS =====

// Types pour les opérations de création
export type CreatePost = Pick<
  AddPostModel,
  'status' | 'authorId' | 'categoryId'
>

export type CreatePostTranslation = Pick<
  AddPostsTranslationModel,
  'postId' | 'language' | 'title' | 'slug' | 'content' | 'description'
>

export type CreateCategory = Pick<
  AddCategoryModel,
  'name' | 'description' | 'icon' | 'image'
>

export type CreateHashtag = Pick<AddHashtagsModel, 'name'>

export type CreatePostHashtag = Pick<
  AddPostHashtagsModel,
  'postId' | 'hashtagId'
>

// Types pour les opérations de mise à jour
export type UpdatePost = {
  id: string
} & Partial<Omit<UpdatePostModel, 'id'>>

export type UpdatePostTranslation = {
  id: string
} & Partial<Omit<PostsTranslationModel, 'id' | 'postId' | 'createdAt'>>

export type UpdateCategory = UpdateCategoryModel & {
  id: string
}

export type UpdateHashtag = {
  id: string
} & Partial<Omit<UpdateHashtagModel, 'id'>>

// ===== DTO POUR LA PRÉSENTATION =====

// DTO = Data Transfer Object pour la présentation
export type PostDTO = {
  id: string
  status: string
  authorId?: string | null
  categoryId?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
  nbView: number
  nbLike: number
}

export type PostTranslationDTO = {
  id: string
  postId: string
  createdAt?: Date | null
  updatedAt?: Date | null
  language: string
  title: string
  slug: string
  content: string
  description: string
}

export type CategoryDTO = Pick<
  CategoryModel,
  'id' | 'name' | 'description' | 'icon' | 'image'
>

export type HashtagDTO = {
  id: string
  name: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

// ===== TYPES POUR LES RELATIONS =====

// Types avec relations complètes (utile pour les queries Drizzle)
export type PostData = PostModel & {
  author?: UserModel
  category?: CategoryModel
  postTranslations?: PostsTranslationModel[]
  postHashtags?: (PostHashtagsModel & {
    hashtag?: HashtagsModel
  })[]
}

export type CategoryData = CategoryModel & {
  posts?: PostModel[]
}

export type HashtagData = HashtagsModel & {
  postHashtags?: (PostHashtagsModel & {
    post?: PostModel
  })[]
}

// ===== TYPES POUR LES FILTRES ET REQUÊTES =====

export type PostFilters = {
  status?: string
  authorId?: string
  categoryId?: string
  language?: string
  title?: string
  tag?: string
}

export type CategoryFilters = {
  name?: string
}

export type HashtagFilters = {
  name?: string
}

// ===== TYPES POUR LA RECHERCHE MULTI-LANGUE =====

export type PostWithTranslations = PostData & {
  currentTranslation?: PostsTranslationModel
}

export type PostSearchResult = {
  id: string
  title: string
  slug: string
  description: string
  language: string
  status: string
  authorId?: string | null
  categoryId?: string | null
  nbView: number
  nbLike: number
  createdAt?: Date | null
  updatedAt?: Date | null
  author?: UserModel
  category?: CategoryModel
  hashtags?: HashtagsModel[]
}

// ===== TYPES POUR LES OPÉRATIONS EN BULK =====

export type PostBulkUpdate = {
  ids: string[]
  updates: Partial<Pick<PostModel, 'status' | 'categoryId'>>
}

export type PostBulkAction = {
  ids: string[]
  action: 'publish' | 'unpublish' | 'archive' | 'delete'
}

// ===== CONSTANTES =====

export const POST_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

//export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es'] as const

export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS]
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
