import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * La configuration du stockage est resolue au chargement du module : chaque
 * cas recharge `./env` avec un environnement different.
 */
const environment = vi.hoisted(() => ({
  NEXT_PUBLIC_NODE_ENV: 'development' as const,
  STORAGE_TYPE: undefined as string | undefined,
  NEXT_PUBLIC_MAX_FILE_SIZE: 5242880,
  NEXT_PUBLIC_ALLOWED_MIME_TYPES: 'image/png',
}))

vi.mock('@/env', () => ({env: environment}))

const loadStorageConfig = async () => {
  vi.resetModules()
  const {getStorageConfig} = await import('./env')

  return getStorageConfig()
}

beforeEach(() => {
  environment.STORAGE_TYPE = undefined
})

describe('getStorageConfig — STORAGE_TYPE', () => {
  it('donne le disque du serveur quand la variable est absente', async () => {
    expect((await loadStorageConfig()).type).toBe('local')
  })

  it('ramene au disque du serveur la valeur `supabase` heritee du socle', async () => {
    environment.STORAGE_TYPE = 'supabase'

    expect((await loadStorageConfig()).type).toBe('local')
  })

  it('refuse bruyamment une valeur inconnue plutot que d’en choisir une', async () => {
    environment.STORAGE_TYPE = 'azure'

    await expect(loadStorageConfig()).rejects.toThrow(/STORAGE_TYPE/)
  })
})
