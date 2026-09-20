/* eslint-disable no-restricted-properties */
import {describe, expect, it} from 'vitest'
import {z} from 'zod'

import {clientSchema, serverSchema} from './env-schemas'
import {getStorageConfig} from './lib/files/storage/env'

const SUPABASE_VARIABLES = [
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_BUCKET',
] as const

const environmentWithoutSupabase = () => {
  const values: Record<string, string | undefined> = {...process.env}

  for (const variable of SUPABASE_VARIABLES) {
    delete values[variable]
  }

  return values
}

describe('Variables d’environnement — plus aucune variable Supabase', () => {
  it('valide la configuration serveur sans variable Supabase', () => {
    const parsed = z
      .object(serverSchema)
      .safeParse(environmentWithoutSupabase())

    expect(parsed.error?.issues ?? []).toEqual([])
  })

  it('valide la configuration client sans variable Supabase', () => {
    const parsed = z
      .object(clientSchema)
      .safeParse(environmentWithoutSupabase())

    expect(parsed.error?.issues ?? []).toEqual([])
  })

  it('ignore sans erreur un environnement qui les definit encore', () => {
    const parsed = z.object(serverSchema).safeParse({
      ...environmentWithoutSupabase(),
      SUPABASE_ANON_KEY: 'cle-heritee',
      NEXT_PUBLIC_SUPABASE_URL: 'https://exemple.supabase.co',
      NEXT_PUBLIC_SUPABASE_BUCKET: 'bucket-herite',
    })

    expect(parsed.success).toBe(true)
  })

  it('demarre avec un STORAGE_TYPE herite du socle', () => {
    const parsed = z.object(serverSchema).safeParse({
      ...environmentWithoutSupabase(),
      STORAGE_TYPE: 'supabase',
    })

    expect(parsed.error?.issues ?? []).toEqual([])
  })

  it('configure le stockage sur le disque sans variable Supabase', () => {
    for (const variable of SUPABASE_VARIABLES) {
      delete process.env[variable]
    }

    expect(getStorageConfig()).toEqual({
      type: 'local',
      config: {
        bucket: expect.any(String),
        basePath: 'dev',
        maxFileSize: expect.any(Number),
        allowedMimeTypes: expect.any(Array),
      },
    })
  })
})
