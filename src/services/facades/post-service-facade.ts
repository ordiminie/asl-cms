import postServiceInterceptor from './interceptors/post-service-logger-interceptor'

// ===== CRUD POSTS =====
export const createPostService = postServiceInterceptor.createPostService
export const getPostByIdService = postServiceInterceptor.getPostByIdService
export const getPostByIdWithRelationsService =
  postServiceInterceptor.getPostByIdWithRelationsService
export const getPostBySlugAndLanguageService =
  postServiceInterceptor.getPostBySlugAndLanguageService
export const updatePostService = postServiceInterceptor.updatePostService
export const deletePostService = postServiceInterceptor.deletePostService

export const publishPostService = postServiceInterceptor.publishPostService
export const unpublishPostService = postServiceInterceptor.unpublishPostService
export const archivePostService = postServiceInterceptor.archivePostService
export const createPostTranslationService =
  postServiceInterceptor.createPostTranslationService
export const getPostTranslationByIdService =
  postServiceInterceptor.getPostTranslationByIdService
export const getPostTranslationsByPostIdService =
  postServiceInterceptor.getPostTranslationsByPostIdService
export const updatePostTranslationService =
  postServiceInterceptor.updatePostTranslationService
export const deletePostTranslationService =
  postServiceInterceptor.deletePostTranslationService

// ===== CRUD CATEGORIES =====
export const createCategoryService =
  postServiceInterceptor.createCategoryService
export const getCategoryByIdService =
  postServiceInterceptor.getCategoryByIdService
export const getAllCategoriesService =
  postServiceInterceptor.getAllCategoriesService
export const getAllCategoriesPublicService =
  postServiceInterceptor.getAllCategoriesPublicService
export const updateCategoryService =
  postServiceInterceptor.updateCategoryService
export const deleteCategoryService =
  postServiceInterceptor.deleteCategoryService

// ===== CRUD HASHTAGS =====
export const createHashtagService = postServiceInterceptor.createHashtagService
export const getHashtagByIdService =
  postServiceInterceptor.getHashtagByIdService
export const getAllHashtagsService =
  postServiceInterceptor.getAllHashtagsService

// ===== SERVICES DE RECHERCHE ET PAGINATION =====
export const getPostsWithPaginationService =
  postServiceInterceptor.getPostsWithPaginationService
export const getPostsWithTranslationsAndPaginationService =
  postServiceInterceptor.getPostsWithTranslationsAndPaginationService

// ===== SERVICES UTILITAIRES =====
export const generateSlugService = postServiceInterceptor.generateSlugService

// ===== SERVICES D'INTERACTION =====
export const likePostService = postServiceInterceptor.likePostService
export const incrementViewPostService =
  postServiceInterceptor.incrementViewPostService

// ===== SERVICES BULK OPERATIONS =====
export const bulkUpdatePostsService =
  postServiceInterceptor.bulkUpdatePostsService
export const bulkActionPostsService =
  postServiceInterceptor.bulkActionPostsService

// ===== SERVICES DE STATISTIQUES =====
export const getPostStatsService = postServiceInterceptor.getPostStatsService

// ===== SERVICES COMPLEXES =====
export const createPostWithTranslationsService =
  postServiceInterceptor.createPostWithTranslationsService
export const updatePostWithTranslationsService =
  postServiceInterceptor.updatePostWithTranslationsService

// ===== SERVICES PUBLICS (SANS AUTORISATION) =====
export const getPublishedPostsWithTranslationsService =
  postServiceInterceptor.getPublishedPostsWithTranslationsService
export const getPublishedPostBySlugAndLanguageService =
  postServiceInterceptor.getPublishedPostBySlugAndLanguageService
export const getPublishedPostBySlugService =
  postServiceInterceptor.getPublishedPostBySlugService
export const getAllPublishedPostSlugsService =
  postServiceInterceptor.getAllPublishedPostSlugsService
