import {
  deleteFile,
  getFile,
  listFiles,
  uploadFile,
} from '@/db/repositories/files-repository'
import {env} from '@/env'
import {FileErrors} from '@/lib/files/errors'
import {getStorageConfig} from '@/lib/files/storage/env'

import {
  canAccessFileByPath,
  canUploadFile,
} from './authorization/file-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {
  ALLOWED_IMAGE_MIME_TYPES,
  DeleteFile,
  EntityType,
  FileListResponse,
  FileResponse,
  GetFile,
  ListFiles,
  UploadFile,
  UploadFileForEntity,
} from './types/domain/file-types'
import {
  deleteFileSchema,
  getFileSchema,
  uploadFileForEntitySchema,
  uploadFileSchema,
} from './validation/file-validation'

const {config} = getStorageConfig()

/**
 * Génère un nom de fichier unique basé sur l'entité
 */
const generateFilePath = (
  entityType: EntityType,
  entityId: string,
  file: File
): string => {
  const timestamp = `${Date.now()}`.slice(5, 10)
  return `${entityType}s/${entityId}/${timestamp}-${file.name}`
}

const getFileUrl = (path: string) => {
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const bucket = config.bucket

  if (!baseUrl) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL n'est pas définie dans les variables d'environnement"
    )
    throw new Error(
      'Configuration manquante : NEXT_PUBLIC_SUPABASE_URL est requise'
    )
  }

  // Ajouter le basePath pour l'URL publique
  const fullPath = `${config.basePath}/${path}`
  return `${baseUrl}/storage/v1/object/public/${bucket}/${fullPath}`
}

/**
 * Upload un fichier avec génération automatique du chemin pour une entité
 *
 * Génère automatiquement un chemin de la forme : `{entityType}s/{entityId}/{category}-{timestamp}.{extension}`
 *
 * Exemples :
 * - User profile: "users/123/profile-1703123456789.jpg"
 * - Organization logo: "organizations/456/logo-1703123456789.png"
 * - Product image: "products/789/image-1703123456789.webp"
 */
export const uploadFileForEntityService = async (
  params: UploadFileForEntity
): Promise<FileResponse> => {
  // Validation des paramètres
  const parsed = uploadFileForEntitySchema.safeParse({
    entityType: params.entityType,
    entityId: params.entityId,
    category: params.category,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const {file, entityType, entityId} = params

  // Vérification des autorisations
  const granted = await canUploadFile(entityType, entityId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Validation de la taille
  if (file.size > config.maxFileSize) {
    throw FileErrors.FILE_TOO_LARGE(file.size, config.maxFileSize)
  }

  // Validation du type MIME
  if (!config.allowedMimeTypes.includes(file.type)) {
    throw FileErrors.INVALID_FILE_TYPE(file.type)
  }

  // Générer le chemin automatiquement
  const path = generateFilePath(entityType, entityId, file)

  await uploadFile(file, path)
  return {
    path,
    url: getFileUrl(path),
    size: file.size,
    type: file.type,
    name: file.name,
  }
}

/**
 * Upload une image avec génération automatique du chemin pour une entité
 *
 * Spécialisé pour les images uniquement avec validation stricte des types MIME
 * Types autorisés : WebP, JPEG, JPG, PNG
 *
 * Exemples :
 * - User profile: "users/123/profile-1703123456789.webp"
 * - Organization logo: "organizations/456/logo-1703123456789.png"
 */
export const uploadImageForEntityService = async (
  params: UploadFileForEntity
): Promise<FileResponse> => {
  // Validation des paramètres
  const parsed = uploadFileForEntitySchema.safeParse({
    entityType: params.entityType,
    entityId: params.entityId,
    category: params.category,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const {file, entityType, entityId} = params

  // Vérification des autorisations
  const granted = await canUploadFile(entityType, entityId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Validation de la taille
  if (file.size > config.maxFileSize) {
    throw FileErrors.FILE_TOO_LARGE(file.size, config.maxFileSize)
  }

  // Validation spécifique pour les images
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    throw new Error(
      `Type d'image non supporté: ${file.type}. Types autorisés : ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`
    )
  }

  // Générer le chemin automatiquement
  const path = generateFilePath(entityType, entityId, file)

  await uploadFile(file, path)
  return {
    path,
    url: getFileUrl(path),
    size: file.size,
    type: file.type,
    name: file.name,
  }
}

/**
 * Upload un fichier avec validation
 */
export const uploadFileService = async (
  params: UploadFile
): Promise<FileResponse> => {
  // Validation des paramètres
  const parsed = uploadFileSchema.safeParse({
    path: params.path,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const {file, path} = params

  // Vérification des autorisations basée sur le chemin
  const granted = await canAccessFileByPath(path)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Validation de la taille
  if (file.size > config.maxFileSize) {
    throw FileErrors.FILE_TOO_LARGE(file.size, config.maxFileSize)
  }

  // Validation du type MIME
  if (!config.allowedMimeTypes.includes(file.type)) {
    throw FileErrors.INVALID_FILE_TYPE(file.type)
  }

  await uploadFile(file, path)
  return {
    path,
    url: getFileUrl(path),
    size: file.size,
    type: file.type,
    name: file.name,
  }
}

/**
 * Supprime un fichier
 */
export const deleteFileService = async (params: DeleteFile): Promise<void> => {
  // Validation des paramètres
  const parsed = deleteFileSchema.safeParse({
    path: params.path,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const {path} = params

  // Vérification des autorisations basée sur le chemin
  const granted = await canAccessFileByPath(path)
  if (!granted) {
    throw new AuthorizationError()
  }

  return await deleteFile(path)
}

/**
 * Récupère un fichier
 */
export const getFileService = async (
  params: GetFile
): Promise<FileResponse> => {
  // Validation des paramètres
  const parsed = getFileSchema.safeParse({
    path: params.path,
  })
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }

  const {path} = params

  // Vérification des autorisations basée sur le chemin
  const granted = await canAccessFileByPath(path)
  if (!granted) {
    throw new AuthorizationError()
  }

  const blob = await getFile(path)
  return {
    path,
    url: getFileUrl(path),
    size: blob.size,
    type: blob.type,
    name: path.split('/').pop() || '',
  }
}

/**
 * Liste les fichiers d'un répertoire
 */
export const listFilesService = async (
  params: ListFiles
): Promise<FileListResponse> => {
  const {path} = params
  const files = await listFiles(path)
  return files.map((file) => ({
    path: `${path}/${file.name}`,
    url: getFileUrl(`${path}/${file.name}`),
    size: file.metadata?.size || 0,
    type: file.metadata?.mimetype || '',
    name: file.name,
  }))
}

/**
 * Upload un fichier pour un post
 */
export const uploadFilePostService = async (
  postId: string,
  file: File
): Promise<FileResponse> => {
  return await uploadImageForEntityService({
    entityType: 'post',
    entityId: postId,
    file,
    category: 'image',
  })
}

/**
 * Liste les fichiers d'un post
 */
export const listFilesByPostIdService = async (
  postId: string
): Promise<FileListResponse> => {
  return await listFilesService({
    path: `posts/${postId}`,
  })
}

/**
 * Supprimer un fichier d'un post
 */
export const deleteFileByPostIdService = async (
  postId: string,
  filename: string
): Promise<void> => {
  return await deleteFileService({
    path: `posts/${postId}/${filename}`,
  })
}
