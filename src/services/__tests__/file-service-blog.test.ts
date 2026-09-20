import {readdir, readFile, rm} from 'node:fs/promises'
import nodePath from 'node:path'

import {faker} from '@faker-js/faker'
import {afterAll, beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * Le blog d'administration herite ecrit ses fichiers d'article sur le disque
 * du serveur (ADR 004). Rien n'est simule entre le service et l'adaptateur :
 * seule la racine du disque est deplacee dans un repertoire temporaire.
 *
 * La racine est fabriquee au chargement du fichier de test :
 * `files-repository` construit son adaptateur a l'import du module, et
 * l'adaptateur local resout sa racine une fois pour toutes.
 */
const localRoot = vi.hoisted(async () => {
  const {mkdtemp} = await import('node:fs/promises')
  const {tmpdir} = await import('node:os')
  const {join} = await import('node:path')

  return {dir: await mkdtemp(join(tmpdir(), 'blog-files-test-'))}
})

const MAX_FILE_SIZE = vi.hoisted(() => 1024)

vi.mock('@/env', async () => {
  const root = await localRoot

  return {env: {LOCAL_STORAGE_ROOT: root.dir}}
})

vi.mock('@/lib/files/storage/env', () => ({
  getStorageConfig: () => ({
    type: 'local' as const,
    config: {
      bucket: 'files',
      basePath: 'dev',
      maxFileSize: MAX_FILE_SIZE,
      allowedMimeTypes: ['image/png'],
    },
  }),
}))

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))

vi.mock('@/db/repositories/post-repository', () => ({
  getPostByIdDao: vi.fn(),
}))

import {getPostByIdDao} from '@/db/repositories/post-repository'

import {
  deleteFileByPostIdService,
  listFilesByPostIdService,
  uploadFilePostService,
  uploadFileService,
} from '../file-service'
import {setupAuthUserMocked} from './helper-service-test'
import {userTestAdmin} from './service-test-data'

const rootDir = async () => (await localRoot).dir

const postDirectory = async (postId: string) =>
  nodePath.join(await rootDir(), 'dev', 'posts', postId)

const storedFiles = async (postId: string): Promise<string[]> => {
  try {
    return await readdir(await postDirectory(postId), {recursive: true})
  } catch {
    return []
  }
}

let postId = ''

beforeEach(async () => {
  postId = faker.string.uuid()
  setupAuthUserMocked(userTestAdmin)
  vi.clearAllMocks()
  vi.mocked(getPostByIdDao).mockResolvedValue({
    id: postId,
    status: 'published',
    authorId: userTestAdmin.id,
  } as Awaited<ReturnType<typeof getPostByIdDao>>)
})

afterAll(async () => {
  await rm(await rootDir(), {recursive: true, force: true})
})

describe('Fichiers du blog sur le disque du serveur', () => {
  it('ecrit le fichier d’un article sous la cle de son post', async () => {
    const file = new File(['image binaire'], 'schema.png', {type: 'image/png'})

    const result = await uploadFilePostService(postId, file)

    expect(result.path.startsWith(`posts/${postId}/`)).toBe(true)
    expect(
      await readFile(nodePath.join(await rootDir(), 'dev', result.path), 'utf8')
    ).toBe('image binaire')
  })

  it('supprime le fichier d’un article', async () => {
    const file = new File(['image binaire'], 'schema.png', {type: 'image/png'})
    const {path} = await uploadFilePostService(postId, file)
    const filename = path.split('/').pop() as string
    expect(await storedFiles(postId)).toContain(
      nodePath.join('image', filename)
    )

    await deleteFileByPostIdService(
      postId,
      path.replace(`posts/${postId}/`, '')
    )

    expect(await storedFiles(postId)).not.toContain(
      nodePath.join('image', filename)
    )
  })

  it('liste les fichiers deposes sous le repertoire de l’article', async () => {
    const file = new File(['image binaire'], 'schema.png', {type: 'image/png'})
    await uploadFileService({file, path: `posts/${postId}/schema.png`})

    const listed = await listFilesByPostIdService(postId)

    expect(listed.map((entry) => entry.name)).toEqual(['schema.png'])
  })

  it('refuse un type de fichier non autorise sans rien ecrire', async () => {
    const file = new File(['%PDF'], 'contrat.pdf', {type: 'application/pdf'})

    await expect(uploadFilePostService(postId, file)).rejects.toThrow(
      /Type d’image non supporté|Type d'image non supporté/
    )
    expect(await storedFiles(postId)).toEqual([])
  })

  it('refuse un fichier trop gros sans rien ecrire', async () => {
    const file = new File(['x'.repeat(MAX_FILE_SIZE + 1)], 'grande.png', {
      type: 'image/png',
    })

    await expect(uploadFilePostService(postId, file)).rejects.toThrow(
      /exceeds maximum allowed size/
    )
    expect(await storedFiles(postId)).toEqual([])
  })
})
