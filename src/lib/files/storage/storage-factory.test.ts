import {File as NodeFile} from 'node:buffer'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const localRoot = vi.hoisted(() => ({dir: ''}))

/*
 * L'environnement simule est reduit a la racine du disque : aucune variable
 * Supabase, aucun STORAGE_TYPE. C'est ce que voit un deploiement qui ne
 * configure rien (criteres 1, 5 et 6 de la story s12a).
 */
vi.mock('@/env', () => ({
  env: {
    get LOCAL_STORAGE_ROOT() {
      return localRoot.dir
    },
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: {error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn()},
}))

import {getStorageConfig} from './env'
import {createStorage} from './storage-factory'

beforeEach(async () => {
  localRoot.dir = await mkdtemp(path.join(tmpdir(), 'storage-factory-test-'))
})

afterEach(async () => {
  await rm(localRoot.dir, {recursive: true, force: true})
})

describe('createStorage', () => {
  it('fabrique un stockage local sous la racine configuree dans @/env', async () => {
    const storage = createStorage('local', {
      bucket: 'local',
      basePath: '',
      maxFileSize: 1024,
      allowedMimeTypes: ['image/png'],
    })

    await storage.upload(
      new NodeFile(['logo'], 'logo.png', {
        type: 'image/png',
      }) as unknown as File,
      'org/identity/logo.png'
    )

    expect(
      await readFile(path.join(localRoot.dir, 'org/identity/logo.png'), 'utf8')
    ).toBe('logo')
  })

  it('refuse un adaptateur non implemente', () => {
    expect(() =>
      createStorage('s3', {
        bucket: 'local',
        basePath: '',
        maxFileSize: 1024,
        allowedMimeTypes: ['image/png'],
      })
    ).toThrow('S3 provider not implemented yet')
  })

  it('ne connait plus supabase comme type de stockage', () => {
    expect(() =>
      createStorage(
        // @ts-expect-error 'supabase' n'est plus un adaptateur du produit
        'supabase',
        {
          bucket: 'local',
          basePath: '',
          maxFileSize: 1024,
          allowedMimeTypes: ['image/png'],
        }
      )
    ).toThrow('Unknown storage provider: supabase')
  })
})

describe('getStorageConfig', () => {
  it('donne le disque local quand STORAGE_TYPE est absente', () => {
    expect(getStorageConfig().type).toBe('local')
  })

  it('ne depend d’aucune variable Supabase pour sa configuration', () => {
    const {config} = getStorageConfig()

    expect(config).toEqual({
      bucket: expect.any(String),
      basePath: 'dev',
      maxFileSize: expect.any(Number),
      allowedMimeTypes: expect.arrayContaining(['image/png']),
    })
  })
})
