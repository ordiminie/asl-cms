import 'server-only'

import {
  getOrganizationByIdDao,
  updateOrganizationIdentityKeyDao,
} from '@/db/repositories/organization-repository'
import {createStorage} from '@/lib/files/storage/storage-factory'
import {StorageOperations} from '@/lib/files/storage/types'
import {logger} from '@/lib/logger'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canManageAssociation} from './authorization/association-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  AssociationIdentityKind,
  AssociationIdentityValidation,
  buildAssociationIdentityKey,
  getIdentityFormatFromKey,
  IDENTITY_FORMAT_CONTENT_TYPES,
  IDENTITY_MAX_BYTES,
  validateAssociationIdentityFile,
} from './types/domain/association-identity-types'
import {
  readAssociationIdentityFileServiceSchema,
  replaceAssociationIdentityFileServiceSchema,
} from './validation/association-identity-validation'

export type AssociationIdentityReplacement =
  | {status: 'replaced'; key: string}
  | {
      status: 'rejected'
      validation: Exclude<AssociationIdentityValidation, {valid: true}>
    }

export type AssociationIdentityFileContent = {
  content: Blob
  contentType: string
}

/**
 * Stockage des fichiers d'identite : l'adaptateur `local` sous la racine de
 * `@/env` (ADR 015). Le type par defaut des autres flux ne change pas.
 */
const getIdentityStorage = (): StorageOperations =>
  createStorage('local', {
    bucket: 'identity',
    basePath: '',
    maxFileSize: Math.max(...Object.values(IDENTITY_MAX_BYTES)),
    allowedMimeTypes: Object.values(IDENTITY_FORMAT_CONTENT_TYPES),
  })

const currentIdentityKey = async (
  organizationId: string,
  kind: AssociationIdentityKind
): Promise<string | null> => {
  const organization = await getOrganizationByIdDao(organizationId)
  if (!organization) {
    throw new NotFoundError('Association introuvable')
  }
  return kind === 'logo'
    ? organization.identityLogoKey
    : organization.identityFaviconKey
}

/**
 * Enregistre la nouvelle reference ; en cas d'echec, retire le fichier tout
 * juste ecrit pour ne laisser ni orphelin ni reference cassee.
 */
const commitIdentityReference = async (
  storage: StorageOperations,
  organizationId: string,
  kind: AssociationIdentityKind,
  newKey: string
): Promise<void> => {
  try {
    await updateOrganizationIdentityKeyDao(organizationId, kind, newKey)
  } catch (error) {
    await storage.delete(newKey).catch((cleanupError: unknown) => {
      logger.error(
        '[ASSOCIATION-IDENTITY] Nouveau fichier orphelin apres echec de la reference',
        {key: newKey, error: (cleanupError as Error).message}
      )
    })
    throw error
  }
}

const deletePreviousIdentityFile = async (
  storage: StorageOperations,
  previousKey: string | null
): Promise<void> => {
  if (!previousKey) return
  try {
    await storage.delete(previousKey)
  } catch (error) {
    logger.warn('[ASSOCIATION-IDENTITY] Ancien fichier laisse orphelin', {
      key: previousKey,
      error: (error as Error).message,
    })
  }
}

/**
 * Remplace le logo ou le favicon d'une association (ADR 015, s01b).
 *
 * Ordre : `safeParse` -> controle d'acces -> validation du fichier -> ecriture
 * sous une nouvelle cle -> mise a jour de la reference -> suppression de
 * l'ancien fichier. Un fichier refuse est rendu comme un resultat, sans rien
 * ecrire : l'ancien fichier et sa reference restent en place.
 */
export const replaceAssociationIdentityFileService = async (
  organizationId: string,
  kind: AssociationIdentityKind,
  file: File
): Promise<AssociationIdentityReplacement> => {
  const parsed = replaceAssociationIdentityFileServiceSchema.safeParse({
    organizationId,
    kind,
    file,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      parsed.data.organizationId,
      ActionIdConst.ASSOCIATION_IDENTITY_UPDATE
    )
  ) {
    throw new AuthorizationError(
      "Seul le bureau de l'association peut modifier son identité"
    )
  }

  const content = new Uint8Array(await file.arrayBuffer())
  const validation = validateAssociationIdentityFile(parsed.data.kind, content)
  if (!validation.valid) {
    return {status: 'rejected', validation}
  }

  const previousKey = await currentIdentityKey(
    parsed.data.organizationId,
    parsed.data.kind
  )
  const storage = getIdentityStorage()
  const newKey = buildAssociationIdentityKey(
    parsed.data.organizationId,
    parsed.data.kind,
    validation.format
  )

  await storage.upload(file, newKey)
  await commitIdentityReference(
    storage,
    parsed.data.organizationId,
    parsed.data.kind,
    newKey
  )
  await deletePreviousIdentityFile(storage, previousKey)

  return {status: 'replaced', key: newKey}
}

/**
 * Lit le logo ou le favicon d'une association pour la route de lecture.
 *
 * **Sans controle d'autorisation, et c'est delibere** : ces fichiers sont
 * affiches sur le site public. La cle vient de la base, jamais de la requete ;
 * elle doit en plus appartenir a cette association et a ce type de fichier.
 */
export const readAssociationIdentityFileService = async (
  organizationId: string,
  kind: AssociationIdentityKind,
  key: string
): Promise<AssociationIdentityFileContent> => {
  const parsed = readAssociationIdentityFileServiceSchema.safeParse({
    organizationId,
    kind,
    key,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const prefix = `${parsed.data.organizationId}/identity/${parsed.data.kind}-`
  const format = getIdentityFormatFromKey(parsed.data.key)
  const fileName = parsed.data.key.slice(prefix.length)
  if (
    !parsed.data.key.startsWith(prefix) ||
    !format ||
    /[/\\]/.test(fileName)
  ) {
    throw new ValidationError("Clé de fichier d'identité invalide")
  }

  return {
    content: await getIdentityStorage().download(parsed.data.key),
    contentType: IDENTITY_FORMAT_CONTENT_TYPES[format],
  }
}

/**
 * L'utilisateur connecte peut-il gerer l'identite de cette association ?
 * Sert l'interface (ecran de refus) ; le remplacement revérifie de son cote.
 */
export const canManageAssociationIdentityService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed =
    replaceAssociationIdentityFileServiceSchema.shape.organizationId.safeParse(
      organizationId
    )
  if (!parsed.success) {
    return false
  }

  const authUser = await getAuthUser()
  return canManageAssociation(authUser, parsed.data)
}
