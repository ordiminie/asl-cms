import {env} from '@/env'

import {createLocalStorage} from './local-storage'
import {createSupabaseStorage} from './supabase-storage'
import {StorageConfig, StorageOperations} from './types'

export type StorageType = 'supabase' | 's3' | 'local'

export const createStorage = (
  type: StorageType,
  config: StorageConfig
): StorageOperations => {
  switch (type) {
    case 'supabase':
      return createSupabaseStorage(config)
    case 'local':
      return createLocalStorage(config, env.LOCAL_STORAGE_ROOT)
    case 's3':
      throw new Error('S3 provider not implemented yet')
    default:
      throw new Error(`Unknown storage provider: ${type}`)
  }
}
