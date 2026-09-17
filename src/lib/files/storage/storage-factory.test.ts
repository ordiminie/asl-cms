import {File as NodeFile} from 'node:buffer'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const localRoot = vi.hoisted(() => ({dir: ''}))

vi.mock('@/env', () => ({
  env: {
    get LOCAL_STORAGE_ROOT() {
      return localRoot.dir
    },
  },
}))
vi.mock('@/lib/files/supabaseClient', () => ({supabase: {}}))
vi.mock('@/lib/logger', () => ({
  logger: {error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn()},
}))

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
})
