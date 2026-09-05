import {routing} from '@/i18n/routing'

export type Pagination = {
  limit: number
  offset: number
}
export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    total: number // ← Nombre total d'éléments
    page: number // ← Page actuelle
    limit: number // ← Éléments par page
    totalPages: number // ← Nombre total de pages
  }
}

export type ActionResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}
export const SUPPORTED_LANGUAGES = routing.locales
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type FileObject = {
  name: string // Nom du fichier
  bucket_id: string // Nom du bucket
  id: string // ID du fichier
  last_accessed_at: string | null // Date de dernier accès
  metadata: {
    mimetype?: string // Type MIME du fichier (ex : image/jpeg)
    size?: number // Taille du fichier en octets
  }
  created_at: string // Date de création du fichier
  updated_at: string // Date de mise à jour du fichier
  //size: number // Taille du fichier en octets
}

export type FileObjectPublic = FileObject & {
  publicUrl?: string // Nom du fichier
}
