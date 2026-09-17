import {randomUUID} from 'node:crypto'
import {createWriteStream} from 'node:fs'
import {mkdir, readdir, readFile, rename, rm, stat} from 'node:fs/promises'
import path from 'node:path'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import type {ReadableStream as NodeReadableStream} from 'node:stream/web'

import {FileErrors} from '@/lib/files/errors'
import {logger} from '@/lib/logger'

import {StorageConfig, StorageOperations, StoredFile} from './types'

/**
 * Resout une cle de stockage en chemin absolu sous la racine, ou refuse.
 *
 * Refuse une cle vide, un octet nul, un chemin absolu (POSIX, Windows), tout
 * segment `..`, et en dernier recours tout chemin resolu hors de la racine.
 */
const resolveInsideRoot = (baseDir: string, key: string): string => {
  const forged =
    key.length === 0 ||
    key.includes('\0') ||
    path.isAbsolute(key) ||
    path.win32.isAbsolute(key) ||
    key.split(/[/\\]/).includes('..')

  const resolved = path.resolve(baseDir, key)
  const insideRoot = resolved.startsWith(`${baseDir}${path.sep}`)

  if (forged || !insideRoot) {
    throw FileErrors.INVALID_PATH(key)
  }

  return resolved
}

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === 'ENOENT'

/**
 * Adaptateur de stockage sur le disque du serveur (ADR 004, ADR 015).
 *
 * Toute cle est confinee sous `rootDir/basePath`. L'ecriture passe par un
 * fichier temporaire du meme repertoire puis un renommage : une ecriture
 * interrompue ne laisse jamais de fichier partiel sous la cle finale.
 */
export const createLocalStorage = (
  config: StorageConfig,
  rootDir: string
): StorageOperations => {
  const baseDir = path.resolve(rootDir, config.basePath)

  const upload = async (file: File, key: string): Promise<{path: string}> => {
    const target = resolveInsideRoot(baseDir, key)
    const temporary = `${target}.${randomUUID()}.tmp`

    try {
      await mkdir(path.dirname(target), {recursive: true})
      await pipeline(
        Readable.fromWeb(file.stream() as unknown as NodeReadableStream),
        createWriteStream(temporary, {flags: 'wx'})
      )
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, {force: true})
      logger.error('Local upload error:', (error as Error).message)
      throw FileErrors.UPLOAD_FAILED((error as Error).message)
    }

    return {path: key}
  }

  const download = async (key: string): Promise<Blob> => {
    const target = resolveInsideRoot(baseDir, key)

    try {
      return new Blob([new Uint8Array(await readFile(target))])
    } catch (error) {
      throw FileErrors.DOWNLOAD_FAILED((error as Error).message)
    }
  }

  const deleteFile = async (key: string): Promise<void> => {
    const target = resolveInsideRoot(baseDir, key)

    try {
      await rm(target, {force: true})
    } catch (error) {
      logger.error('Local delete error:', (error as Error).message)
      throw FileErrors.DELETE_FAILED((error as Error).message)
    }
  }

  const list = async (key: string): Promise<StoredFile[]> => {
    const directory = resolveInsideRoot(baseDir, key)

    try {
      const entries = await readdir(directory, {withFileTypes: true})
      const files = entries.filter((entry) => entry.isFile())
      return await Promise.all(
        files.map(async (entry) => ({
          name: entry.name,
          size: (await stat(path.join(directory, entry.name))).size,
        }))
      )
    } catch (error) {
      if (isMissing(error)) {
        return []
      }
      throw FileErrors.LIST_FAILED((error as Error).message)
    }
  }

  return {
    upload,
    download,
    delete: deleteFile,
    list,
  }
}
