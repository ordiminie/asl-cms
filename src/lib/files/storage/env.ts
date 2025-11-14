import {z} from 'zod'

import {env} from '@/env'

const envSchema = z.object({
  NEXT_PUBLIC_NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  STORAGE_TYPE: z.enum(['supabase', 's3']).default('supabase'),
  NEXT_PUBLIC_SUPABASE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_MAX_FILE_SIZE: z.number().default(5242880), // 5MB
  NEXT_PUBLIC_ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/gif,application/pdf'),
})

export const storageEnv = envSchema.parse({
  NEXT_PUBLIC_NODE_ENV: env.NEXT_PUBLIC_NODE_ENV,
  STORAGE_TYPE: env.STORAGE_TYPE,
  NEXT_PUBLIC_SUPABASE_BUCKET: env.NEXT_PUBLIC_SUPABASE_BUCKET,
  NEXT_PUBLIC_MAX_FILE_SIZE: env.NEXT_PUBLIC_MAX_FILE_SIZE,
  NEXT_PUBLIC_ALLOWED_MIME_TYPES: env.NEXT_PUBLIC_ALLOWED_MIME_TYPES,
})

export const getStorageConfig = () => {
  const basePath =
    storageEnv.NEXT_PUBLIC_NODE_ENV === 'production' ? 'prod' : 'dev'

  return {
    type: storageEnv.STORAGE_TYPE,
    config: {
      baseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      bucket: storageEnv.NEXT_PUBLIC_SUPABASE_BUCKET,
      basePath,
      maxFileSize: storageEnv.NEXT_PUBLIC_MAX_FILE_SIZE,
      allowedMimeTypes: storageEnv.NEXT_PUBLIC_ALLOWED_MIME_TYPES.split(','),
    },
  }
}
