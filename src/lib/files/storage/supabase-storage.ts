import {FileObject} from '@supabase/storage-js'

import {FileErrors} from '@/lib/files/errors'
import {supabase} from '@/lib/files/supabaseClient'
import {logger} from '@/lib/logger'

import {StorageConfig, StorageOperations} from './types'

const getFullPath = (config: StorageConfig, path: string): string => {
  return `${config.basePath}/${path}`
}

export const createSupabaseStorage = (
  config: StorageConfig
): StorageOperations => {
  const upload = async (file: File, path: string): Promise<{path: string}> => {
    const fullPath = getFullPath(config, path)
    const {data, error} = await supabase.storage
      .from(config.bucket)
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      logger.error('Upload error:', error.message)
      throw FileErrors.UPLOAD_FAILED(error.message)
    }

    return {path: data.path}
  }

  const download = async (path: string): Promise<Blob> => {
    const fullPath = getFullPath(config, path)
    const {data, error} = await supabase.storage
      .from(config.bucket)
      .download(fullPath)

    if (error) {
      logger.error('Download error:', error.message)
      throw FileErrors.DOWNLOAD_FAILED(error.message)
    }

    return data
  }

  const deleteFile = async (path: string): Promise<void> => {
    const fullPath = getFullPath(config, path)
    const {error} = await supabase.storage
      .from(config.bucket)
      .remove([fullPath])

    if (error) {
      logger.error('Delete error:', error.message)
      throw FileErrors.DELETE_FAILED(error.message)
    }
  }

  const list = async (path: string): Promise<FileObject[]> => {
    const fullPath = getFullPath(config, path)
    const {data, error} = await supabase.storage
      .from(config.bucket)
      .list(fullPath)

    if (error) {
      logger.error('List error:', error.message)
      throw FileErrors.LIST_FAILED(error.message)
    }

    return data
  }

  return {
    upload,
    download,
    delete: deleteFile,
    list,
  }
}
