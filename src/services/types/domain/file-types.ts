// Types de base
export type File = globalThis.File

// Types d'entités supportées
export type EntityType =
  'user' | 'organization' | 'product' | 'generic' | 'post'

// Types de fichiers pour une entité
export type FileCategory = 'profile' | 'logo' | 'banner' | 'document' | 'image'

// Constantes pour les types d'entités
export const EntityTypeConst = {
  USER: 'user' as EntityType,
  ORGANIZATION: 'organization' as EntityType,
  PRODUCT: 'product' as EntityType,
  GENERIC: 'generic' as EntityType,
  POST: 'post' as EntityType,
} as const

// Constantes pour les catégories de fichiers
export const FileCategoryConst = {
  PROFILE: 'profile' as FileCategory,
  LOGO: 'logo' as FileCategory,
  BANNER: 'banner' as FileCategory,
  DOCUMENT: 'document' as FileCategory,
  IMAGE: 'image' as FileCategory,
} as const

// Types MIME autorisés pour les images
export const ImageMimeTypes = {
  WEBP: 'image/webp',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  PNG: 'image/png',
} as const

export const ALLOWED_IMAGE_MIME_TYPES = Object.values(ImageMimeTypes)

// Types pour les opérations
export type UploadFile = {
  file: File
  path: string
}

// Upload avec génération automatique du chemin
export type UploadFileForEntity = {
  file: File
  entityType: EntityType
  entityId: string
  category?: FileCategory
}

export type DeleteFile = {
  path: string
}

export type GetFile = {
  path: string
}

export type ListFiles = {
  path: string
}

// Types de réponse
export type FileResponse = {
  path: string
  url: string
  size: number
  type: string
  name: string
}

export type FileListResponse = FileResponse[]
