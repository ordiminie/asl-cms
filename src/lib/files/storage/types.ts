export type StorageConfig = {
  bucket: string
  basePath: string
  maxFileSize: number
  allowedMimeTypes: string[]
}

/**
 * Un fichier liste par un adaptateur de stockage. Type neutre : aucun
 * adaptateur n'impose son propre format (ADR 004).
 */
export type StoredFile = {
  name: string
  size: number
  mimeType?: string
}

export type StorageOperations = {
  upload: (file: File, path: string) => Promise<{path: string}>
  download: (path: string) => Promise<Blob>
  delete: (path: string) => Promise<void>
  list: (path: string) => Promise<StoredFile[]>
}
