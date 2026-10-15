/* eslint-disable no-restricted-properties */
import {describe, expect, it} from 'vitest'
import {z} from 'zod'

import {env} from '@/env'

import {
  AuthMethodSchema,
  clientSchema,
  EnabledPageSchema,
  EnabledPagesSchema,
  serverSchema,
} from './env-schemas'
import {getStorageConfig} from './lib/files/storage/env'

const SUPABASE_VARIABLES = [
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_BUCKET',
] as const

/*
 * Le chemin de base du stockage suit l'environnement reel : `prod` en
 * production, `dev` ailleurs. L'attendu est derive de la meme source que le
 * code, sinon le test ne passe que sur la machine qui l'a ecrit.
 */
const expectedBasePath =
  env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'prod' : 'dev'

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
        basePath: expectedBasePath,
        maxFileSize: expect.any(Number),
        allowedMimeTypes: expect.any(Array),
      },
    })
  })
})

describe('NEXT_PUBLIC_ENABLED_PAGES — blog et docs retirés (s45)', () => {
  it.each(['blog', 'docs'])('refuse la famille retirée %s', (page) => {
    expect(EnabledPageSchema.safeParse(page).success).toBe(false)
    expect(EnabledPagesSchema.safeParse(`account,${page}`).success).toBe(false)
  })

  it('accepte les familles encore servies', () => {
    expect(EnabledPagesSchema.parse('none,account,admin')).toEqual([
      'none',
      'account',
      'admin',
    ])
  })
})

describe('NEXT_PUBLIC_ENABLED_PAGES — familles du compte hérité retirées (s46)', () => {
  it.each([
    'apikey',
    'organization',
    'invitation',
    'subscription',
    'notifications',
    'settings',
  ])('refuse la famille retirée %s', (page) => {
    expect(EnabledPageSchema.safeParse(page).success).toBe(false)
    expect(EnabledPagesSchema.safeParse(`account,${page}`).success).toBe(false)
  })

  it('ne connaît plus que none, account et admin', () => {
    expect(EnabledPageSchema.options).toEqual(['none', 'account', 'admin'])
  })
})

describe('Méthodes d’authentification — ni Apple ni GitHub (s46b, décision L)', () => {
  it.each(['apple', 'github'])('refuse la méthode %s', (method) => {
    expect(AuthMethodSchema.safeParse(method).success).toBe(false)
    expect(
      clientSchema.NEXT_PUBLIC_AUTH_METHODS.safeParse(`credential,${method}`)
        .success
    ).toBe(false)
  })

  it('garde Google comme valeur valide, pour la V2', () => {
    expect(AuthMethodSchema.safeParse('google').success).toBe(true)
  })

  it('n’active par défaut que le mot de passe et le lien magique', () => {
    expect(clientSchema.NEXT_PUBLIC_AUTH_METHODS.parse(undefined)).toEqual([
      'credential',
      'magiclink',
    ])
  })
})
