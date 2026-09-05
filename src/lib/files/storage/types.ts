import {FileObject} from '@supabase/storage-js'

export type StorageConfig = {
  bucket: string
  basePath: string
  maxFileSize: number
  allowedMimeTypes: string[]
}

export type StorageOperations = {
  upload: (file: File, path: string) => Promise<{path: string}>
  download: (path: string) => Promise<Blob>
  delete: (path: string) => Promise<void>
  list: (path: string) => Promise<FileObject[]>
}
