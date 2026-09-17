import {Blob as NodeBlob, File as NodeFile} from 'node:buffer'
import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: {error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn()},
}))

import {createLocalStorage} from './local-storage'
import {StorageConfig} from './types'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const config: StorageConfig = {
  bucket: 'local',
  basePath: '',
  maxFileSize: 1024 * 1024,
  allowedMimeTypes: ['image/png'],
}

const pngFile = (content: string, name = 'logo.png') =>
  new NodeFile([content], name, {type: 'image/png'}) as unknown as File

const blobText = async (blob: Blob) =>
  await (blob as unknown as NodeBlob).text()

let rootDir: string

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), 'local-storage-test-'))
})

afterEach(async () => {
  await rm(rootDir, {recursive: true, force: true})
})

describe('createLocalStorage — aller-retour', () => {
  it('ecrit, relit, liste puis supprime un fichier sous la racine', async () => {
    const storage = createLocalStorage(config, rootDir)
    const key = `${ORG_A}/identity/logo-abc.png`

    await expect(storage.upload(pngFile('contenu-a'), key)).resolves.toEqual({
      path: key,
    })
    expect(await readFile(path.join(rootDir, key), 'utf8')).toBe('contenu-a')

    expect(await blobText(await storage.download(key))).toBe('contenu-a')

    await expect(storage.list(`${ORG_A}/identity`)).resolves.toEqual([
      {name: 'logo-abc.png', size: 'contenu-a'.length},
    ])

    await storage.delete(key)
    await expect(storage.download(key)).rejects.toThrow()
    await expect(storage.list(`${ORG_A}/identity`)).resolves.toEqual([])
  })

  it('place le fichier sous le basePath configure', async () => {
    const storage = createLocalStorage({...config, basePath: 'dev'}, rootDir)

    await storage.upload(pngFile('x'), `${ORG_A}/identity/logo-1.png`)

    expect(
      await readFile(
        path.join(rootDir, 'dev', ORG_A, 'identity', 'logo-1.png'),
        'utf8'
      )
    ).toBe('x')
  })

  it('liste un repertoire absent comme vide', async () => {
    const storage = createLocalStorage(config, rootDir)

    await expect(storage.list(`${ORG_A}/identity`)).resolves.toEqual([])
  })
})

describe('createLocalStorage — prefixes d organisation', () => {
  it('deux organisations ne voient pas les fichiers l une de l autre', async () => {
    const storage = createLocalStorage(config, rootDir)

    await storage.upload(pngFile('a'), `${ORG_A}/identity/logo.png`)
    await storage.upload(pngFile('b'), `${ORG_B}/identity/logo.png`)

    expect(
      await blobText(await storage.download(`${ORG_A}/identity/logo.png`))
    ).toBe('a')
    expect(
      await blobText(await storage.download(`${ORG_B}/identity/logo.png`))
    ).toBe('b')
    await expect(storage.list(`${ORG_A}/identity`)).resolves.toEqual([
      {name: 'logo.png', size: 1},
    ])
    await expect(storage.list(ORG_A)).resolves.toEqual([])
  })
})

describe('createLocalStorage — chemins forges', () => {
  const forged = [
    '../evil.png',
    `${ORG_A}/../../evil.png`,
    `${ORG_A}/identity/../../../evil.png`,
    '/etc/passwd',
    '\\windows\\evil.png',
    'C:\\evil.png',
    `${ORG_A}/identity/logo.png\0.txt`,
    '',
  ]

  it.each(forged)('refuse l ecriture sous %j', async (forgedPath) => {
    const storage = createLocalStorage(config, rootDir)

    await expect(storage.upload(pngFile('x'), forgedPath)).rejects.toThrow()
    expect(await readdir(path.dirname(rootDir))).not.toContain('evil.png')
  })

  it.each(forged)(
    'refuse la lecture, la suppression et la liste sous %j',
    async (forgedPath) => {
      const storage = createLocalStorage(config, rootDir)

      await expect(storage.download(forgedPath)).rejects.toThrow()
      await expect(storage.delete(forgedPath)).rejects.toThrow()
      await expect(storage.list(forgedPath)).rejects.toThrow()
    }
  )
})

describe('createLocalStorage — ecriture atomique', () => {
  it('une ecriture interrompue ne laisse aucun fichier, ni partiel ni temporaire', async () => {
    const storage = createLocalStorage(config, rootDir)
    const key = `${ORG_A}/identity/logo-interrompu.png`
    const interrupted = {
      name: 'logo.png',
      type: 'image/png',
      size: 10_000,
      stream: () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('debut-du-fichier'))
          },
          pull(controller) {
            controller.error(new Error('connexion coupee'))
          },
        }),
    } as unknown as File

    await expect(storage.upload(interrupted, key)).rejects.toThrow()

    await expect(storage.download(key)).rejects.toThrow()
    const identityDir = path.join(rootDir, ORG_A, 'identity')
    const remaining = await readdir(identityDir).catch(() => [])
    expect(remaining).toEqual([])
  })

  it('remplacer une cle existante ne laisse jamais un contenu melange', async () => {
    const storage = createLocalStorage(config, rootDir)
    const key = `${ORG_A}/identity/logo.png`

    await storage.upload(pngFile('ancien-contenu-long'), key)
    await storage.upload(pngFile('neuf'), key)

    expect(await blobText(await storage.download(key))).toBe('neuf')
    expect(await readdir(path.join(rootDir, ORG_A, 'identity'))).toEqual([
      'logo.png',
    ])
  })
})
