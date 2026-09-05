import {FileObject} from '@supabase/storage-js'

import {FileErrors} from '@/lib/files/errors'
import {getStorageConfig} from '@/lib/files/storage/env'
import {createStorage} from '@/lib/files/storage/storage-factory'

const {type, config} = getStorageConfig()
const storage = createStorage(type, config)

const validateFile = async (file: File) => {
  if (!config.allowedMimeTypes.includes(file.type)) {
    throw FileErrors.INVALID_FILE_TYPE(file.type)
  }
  if (file.size > config.maxFileSize) {
    throw FileErrors.FILE_TOO_LARGE(file.size, config.maxFileSize)
  }
}

export const uploadFilePost = async (
  postId: string,
  file: File,
  path: string
) => {
  await validateFile(file)
  const entity = 'posts'
  return await uploadFile(file, `${entity}/${postId}/${path}`)
}

export const listFilesbyPostId = async (
  postId: string
): Promise<FileObject[]> => {
  const path = `posts/${postId}`
  return await listFiles(path)
}

export const deleteFile = async (path: string) => {
  await storage.delete(path)
}

export const deleteFileByPostId = async (postId: string, path: string) => {
  const fullPath = `posts/${postId}/${path}`
  await deleteFile(fullPath)
}

export const uploadFile = async (file: File, path: string) => {
  await validateFile(file)
  return await storage.upload(file, path)
}

export const getFile = async (path: string) => {
  return await storage.download(path)
}

export const listFiles = async (path: string) => {
  return await storage.list(path)
}
