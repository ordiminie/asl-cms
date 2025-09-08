import {z} from 'zod'

import {env} from '@/env'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  STORAGE_TYPE: z.enum(['supabase', 's3']).default('supabase'),
  SUPABASE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_MAX_FILE_SIZE: z.number().default(5242880), // 5MB
  ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/gif,application/pdf'),
})

export const storageEnv = envSchema.parse({
  NODE_ENV: env.NODE_ENV,
  STORAGE_TYPE: env.STORAGE_TYPE,
  SUPABASE_BUCKET: env.SUPABASE_BUCKET,
  NEXT_PUBLIC_MAX_FILE_SIZE: env.NEXT_PUBLIC_MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES: env.ALLOWED_MIME_TYPES,
})

export const getStorageConfig = () => {
  const basePath = storageEnv.NODE_ENV === 'production' ? 'prod' : 'dev'

  return {
    type: storageEnv.STORAGE_TYPE,
    config: {
      bucket: storageEnv.SUPABASE_BUCKET,
      basePath,
      maxFileSize: storageEnv.NEXT_PUBLIC_MAX_FILE_SIZE,
      allowedMimeTypes: storageEnv.ALLOWED_MIME_TYPES.split(','),
    },
  }
}
