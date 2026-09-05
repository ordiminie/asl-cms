import {createSupabaseStorage} from './supabase-storage'
import {StorageConfig, StorageOperations} from './types'

export type StorageType = 'supabase' | 's3'
//todo adapter
export const createStorage = (
  type: StorageType,
  config: StorageConfig
): StorageOperations => {
  switch (type) {
    case 'supabase':
      return createSupabaseStorage(config)
    case 's3':
      throw new Error('S3 provider not implemented yet')
    default:
      throw new Error(`Unknown storage provider: ${type}`)
  }
}
