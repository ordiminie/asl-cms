import 'server-only'

import {createStorage} from '@/lib/files/storage/storage-factory'
import {StorageOperations} from '@/lib/files/storage/types'

import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {
  CONTENT_FILE_CONTENT_TYPES,
  CONTENT_FILE_MAX_BYTES,
  getContentFileFormatFromKey,
  isContentFileKeyAllowed,
} from './types/domain/content-file-types'
import {readContentFileServiceSchema} from './validation/content-file-validation'

export type ContentFileContent = {content: Blob; contentType: string}

/**
 * Stockage des fichiers de contenu (pages, actualites) : l'adaptateur `local`
 * sous la racine de `@/env` (ADR 015), avec la configuration posee par s04
 * pour les pages. Les cles deja stockees restent lisibles a l'identique.
 */
export const getContentFileStorage = (): StorageOperations =>
  createStorage('local', {
    bucket: 'pages',
    basePath: '',
    maxFileSize: Math.max(...Object.values(CONTENT_FILE_MAX_BYTES)),
    allowedMimeTypes: Object.values(CONTENT_FILE_CONTENT_TYPES),
  })

/**
 * Lit un fichier de contenu pour la route publique `/api/files` (ADR 023).
 *
 * **Sans controle d'autorisation, et c'est delibere** : ces fichiers
 * s'affichent sur le site public. La cle **vient de la requete** : elle est
 * donc validee contre les portees enregistrees de l'association resolue par le
 * domaine avant toute lecture.
 */
export const readContentFileService = async (
  organizationId: string,
  key: string
): Promise<ContentFileContent> => {
  const parsed = readContentFileServiceSchema.safeParse({organizationId, key})
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  if (!isContentFileKeyAllowed(parsed.data.organizationId, parsed.data.key)) {
    throw new ValidationError('Clé de fichier de contenu invalide')
  }

  const format = getContentFileFormatFromKey(parsed.data.key)
  if (!format) {
    throw new ValidationError('Clé de fichier de contenu invalide')
  }

  return {
    content: await getContentFileStorage().download(parsed.data.key),
    contentType: CONTENT_FILE_CONTENT_TYPES[format],
  }
}
