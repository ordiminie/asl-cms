'use server'

import {revalidatePath} from 'next/cache'
import * as z from 'zod'

import {requireActionAuth} from '@/app/dal/user-dal'
import {
  FormState,
  PostFormData,
  postFormSchema,
} from '@/components/features/admin/blog/post-form-validation'
import {getAuthUser} from '@/services/authentication/auth-service'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  isValidationParsedZodError,
  ValidationError,
} from '@/services/errors/validation-error'
import {
  deleteFileByPostIdService,
  listFilesByPostIdService,
  uploadFilePostService,
} from '@/services/facades/file-service-facade'
import {
  createPostWithTranslationsService,
  deletePostService,
  updatePostService,
  updatePostWithTranslationsService,
} from '@/services/facades/post-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'
import {FileResponse} from '@/services/types/domain/file-types'
import {
  CreatePostTranslation,
  POST_STATUS,
  SupportedLanguage,
} from '@/services/types/domain/post-types'
import {uuidSchema} from '@/services/validation/common-validation'

// Types pour les traductions sans postId (pour les Server Actions)
type TranslationInput = {
  language: SupportedLanguage
  title: string
  slug: string
  description: string
  content: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
}

/**
 * Nettoie un hashtag pour qu'il respecte les règles de validation
 */
function sanitizeHashtag(input: string): string {
  return input
    .trim()
    .replace(/^#/, '') // Enlever # du début si présent
    .replace(/[^a-zA-Z0-9_]/g, '') // Ne garder que lettres, chiffres et underscores
    .toLowerCase() // Convertir en minuscules
}

/**
 * Nettoie une liste de hashtags
 */
function sanitizeHashtags(hashtags: string[]): string[] {
  return hashtags
    .map(sanitizeHashtag)
    .filter((tag) => tag.length >= 2) // Garder seulement les hashtags de 2+ caractères
    .filter((tag, index, array) => array.indexOf(tag) === index) // Supprimer les doublons
}

export async function createPostAction(data: PostFormData): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })
  try {
    // Validation des données
    const validatedData = postFormSchema.parse(data)

    // Récupération de l'utilisateur authentifié
    const user = await getAuthUser()
    if (!user) {
      throw new AuthorizationError('Utilisateur non authentifié')
    }

    // Transformation des données pour le service
    const postData = {
      status: validatedData.status,
      authorId: user.id,
      categoryId:
        validatedData.categoryId === 'none' ? null : validatedData.categoryId,
    }

    const translationsData: TranslationInput[] = validatedData.translations.map(
      (translation) => ({
        language: translation.language as SupportedLanguage,
        title: translation.title,
        slug: translation.slug,
        description: translation.description || '',
        content: translation.content || '',
        metaTitle: translation.metaTitle || '',
        metaDescription: translation.metaDescription || '',
        metaKeywords: translation.metaKeywords || '',
      })
    )

    // Séparation des hashtags existants (IDs) et nouveaux (noms)
    const existingHashtags = validatedData.hashtags || []
    const newHashtagsToCreate = sanitizeHashtags(
      validatedData.newHashtags || []
    )

    // Création du post avec traductions
    // Convertir TranslationInput en CreatePostTranslation en ajoutant un postId temporaire
    const translationsWithPostId = translationsData.map((t) => ({
      ...t,
      postId: '', // Sera remplacé par le service
    }))

    await createPostWithTranslationsService(
      postData,
      translationsWithPostId as CreatePostTranslation[],
      existingHashtags,
      newHashtagsToCreate
    )

    // Revalidation du cache
    revalidatePath('/admin/blog')

    return {
      success: true,
      message: 'Post créé avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la création du post:', error)

    if (error instanceof ValidationError) {
      return {
        success: false,
        message: error.message,
      }
    }

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: error.message,
      }
    }

    // Gestion des erreurs Zod depuis les services
    const validationError = isValidationParsedZodError(error)
    if (validationError) {
      return {
        success: false,
        message: `Erreur de validation: ${error.message}`,
        errors: error.zodErrorFields?.issues.map((err) => ({
          field: err.path.join('.') as keyof PostFormData, // Garder le chemin complet
          message: err.message,
        })),
      }
    }

    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {}
      error.issues.forEach((err) => {
        const path = err.path.join('.')
        if (!fieldErrors[path]) {
          fieldErrors[path] = []
        }
        fieldErrors[path].push(err.message)
      })

      return {
        success: false,
        message: 'Données invalides',
        fieldErrors,
      }
    }

    return {
      success: false,
      message: 'Une erreur inattendue est survenue',
    }
  }
}

export async function updatePostCompleteAction(
  postId: string,
  data: PostFormData
): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })
  try {
    // Validation des données
    const validatedData = postFormSchema.parse(data)

    // Transformation des données pour le service
    const postData = {
      id: postId,
      status: validatedData.status,
      categoryId:
        validatedData.categoryId === 'none' ? null : validatedData.categoryId,
    }

    const translationsData: TranslationInput[] = validatedData.translations.map(
      (translation) => ({
        language: translation.language as SupportedLanguage,
        title: translation.title,
        slug: translation.slug,
        description: translation.description || '',
        content: translation.content || '',
        metaTitle: translation.metaTitle || '',
        metaDescription: translation.metaDescription || '',
        metaKeywords: translation.metaKeywords || '',
      })
    )

    // Séparation des hashtags existants (IDs) et nouveaux (noms)
    const existingHashtags = validatedData.hashtags || []
    const newHashtagsToCreate = sanitizeHashtags(
      validatedData.newHashtags || []
    )

    // Mise à jour du post avec traductions
    // Convertir TranslationInput en CreatePostTranslation en ajoutant un postId temporaire
    const translationsWithPostId = translationsData.map((t) => ({
      ...t,
      postId: postId, // Utiliser l'ID du post existant
    }))

    await updatePostWithTranslationsService(
      postData,
      translationsWithPostId as CreatePostTranslation[],
      existingHashtags,
      newHashtagsToCreate
    )

    // Revalidation du cache
    revalidatePath('/admin/blog')
    revalidatePath(`/admin/blog/${postId}/edit`)

    return {
      success: true,
      message: 'Post mis à jour avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du post:', error)

    if (error instanceof ValidationError) {
      return {
        success: false,
        message: error.message,
      }
    }

    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: error.message,
      }
    }

    // Gestion des erreurs Zod depuis les services
    const validationError = isValidationParsedZodError(error)
    if (validationError) {
      return {
        success: false,
        message: `Erreur de validation: ${error.message}`,
        errors: error.zodErrorFields?.issues.map((err) => ({
          field: err.path.join('.') as keyof PostFormData, // Garder le chemin complet
          message: err.message,
        })),
      }
    }

    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {}
      error.issues.forEach((err) => {
        const path = err.path.join('.')
        if (!fieldErrors[path]) {
          fieldErrors[path] = []
        }
        fieldErrors[path].push(err.message)
      })

      return {
        success: false,
        message: 'Données invalides',
        fieldErrors,
      }
    }

    return {
      success: false,
      message: 'Une erreur inattendue est survenue',
    }
  }
}

// Action simple pour mise à jour rapide depuis la liste
export async function updatePostAction(
  id: string,
  formData: FormData
): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })
  try {
    const status = formData.get('status') as string
    const categoryId = formData.get('categoryId') as string

    // Validation basique
    if (
      !status ||
      !Object.values(POST_STATUS).includes(
        status as 'draft' | 'published' | 'archived'
      )
    ) {
      return {
        success: false,
        message: 'Statut invalide',
      }
    }

    await updatePostService({
      id,
      status: status as 'draft' | 'published' | 'archived',
      categoryId: categoryId || null,
    })

    revalidatePath('/admin/blog')
    return {
      success: true,
      message: 'Post mis à jour avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du post:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}

export async function deletePostAction(id: string): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })
  try {
    await deletePostService(id)

    revalidatePath('/admin/blog')
    return {
      success: true,
      message: 'Post supprimé avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du post:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}

// ===== ACTIONS FICHIERS =====

// Types pour les actions de fichiers
interface FileActionResult {
  success: boolean
  message: string
  data?: FileResponse
}

/**
 * Upload un fichier pour un post
 */
export async function uploadFileAction(
  postId: string,
  formData: FormData
): Promise<FileActionResult> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    // Validation du postId
    const parsed = uuidSchema.safeParse(postId)
    if (!parsed.success) {
      return {success: false, message: 'ID de post invalide'}
    }

    const file = formData.get('file') as File
    if (!file) {
      return {success: false, message: 'Aucun fichier fourni'}
    }

    const data = await uploadFilePostService(postId, file)

    revalidatePath('/admin/blog')
    return {
      success: true,
      message: 'Fichier uploadé avec succès!',
      data,
    }
  } catch (error) {
    console.error("Erreur d'upload:", error)
    // Revalidate even on error to refresh file list
    revalidatePath('/admin/blog')
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Erreur lors de l'upload",
    }
  }
}

/**
 * Lister les fichiers d'un post
 */
export async function listFilesAction(postId: string): Promise<FileResponse[]> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    const files = await listFilesByPostIdService(postId)
    return files
  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error)
    return []
  }
}

/**
 * Supprimer un fichier
 */
export async function deleteFileAction(
  postId: string,
  filename: string
): Promise<FileActionResult> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    // Validation du postId
    const parsed = uuidSchema.safeParse(postId)
    if (!parsed.success) {
      return {success: false, message: 'ID de post invalide'}
    }

    await deleteFileByPostIdService(postId, filename)

    revalidatePath('/admin/blog')
    return {
      success: true,
      message: 'Fichier supprimé avec succès!',
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la suppression',
    }
  }
}
