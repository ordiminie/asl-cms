import 'server-only'

import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {
  createSharedDocumentDao,
  deleteSharedDocumentDao,
  getSharedDocumentByIdDao,
  listSharedDocumentsDao,
  SharedDocumentRow,
} from '@/db/repositories/shared-document-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {getContentFileStorage} from './content-file-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {UnauthenticatedError} from './errors/unauthenticated-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {CategoryDomainConst} from './types/domain/association-category-types'
import {validateContentFile} from './types/domain/content-file-types'
import {
  buildSharedDocumentFileKey,
  BureauSharedDocumentDTO,
  SHARED_DOCUMENT_TITLE_MAX_LENGTH,
  SharedDocumentDeleteResult,
  SharedDocumentDTO,
  SharedDocumentIssue,
  SharedDocumentIssueConst,
  SharedDocumentPublishResult,
} from './types/domain/shared-document-types'
import {
  publishSharedDocumentServiceSchema,
  sharedDocumentOrganizationIdSchema,
  sharedDocumentReferenceServiceSchema,
} from './validation/shared-document-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les documents partagés"
const READ_DENIED =
  "Seuls les membres de l'association lisent ses documents partagés"
const DOCUMENT_NOT_FOUND = 'Document introuvable'

/** Le fichier d'un document, et le titre qui nomme son telechargement. */
export type SharedDocumentFile = {content: Blob; title: string}

type CheckedFile = {file: File; bytes: number}

const toMemberDto = (row: SharedDocumentRow): SharedDocumentDTO => ({
  id: row.id,
  title: row.title,
  categoryName: row.categoryName,
  fileBytes: row.fileBytes,
  createdAt: row.createdAt,
})

const toBureauDto = (row: SharedDocumentRow): BureauSharedDocumentDTO => ({
  ...toMemberDto(row),
  categoryId: row.categoryId,
})

const requireAction = async (
  organizationId: string,
  actionId: string,
  deniedMessage: string
): Promise<void> => {
  const authUser = await getAuthUser()
  if (!canPerformAction(authUser, organizationId, actionId)) {
    throw new AuthorizationError(deniedMessage)
  }
}

const requireManager = (organizationId: string) =>
  requireAction(
    organizationId,
    ActionIdConst.SHARED_DOCUMENT_MANAGE,
    MANAGE_DENIED
  )

const hasFile = (file: File | null | undefined): file is File =>
  file instanceof File && file.size > 0

const checkTitle = (title: string): SharedDocumentIssue[] => {
  if (title === '') return [SharedDocumentIssueConst.TITLE_MISSING]
  if (title.length > SHARED_DOCUMENT_TITLE_MAX_LENGTH) {
    return [SharedDocumentIssueConst.TITLE_TOO_LONG]
  }
  return []
}

/**
 * La categorie choisie, **active et du domaine `document`**, lue dans le
 * scope du tenant : un identifiant supprime, d'un autre domaine ou d'une autre
 * association n'y est pas visible, donc refuse.
 */
const checkCategory = async (
  organizationId: string,
  categoryId: string
): Promise<{issues: SharedDocumentIssue[]; name?: string}> => {
  if (categoryId === '') {
    return {issues: [SharedDocumentIssueConst.CATEGORY_MISSING]}
  }

  const offered = await withTenant(organizationId, () =>
    listActiveCategoriesDao(organizationId, CategoryDomainConst.DOCUMENT)
  )
  const category = offered.find((candidate) => candidate.id === categoryId)
  return category
    ? {issues: [], name: category.name}
    : {issues: [SharedDocumentIssueConst.CATEGORY_UNAVAILABLE]}
}

/** Valide le fichier par **signature binaire** (PDF, 10 Mo), sans rien ecrire. */
const checkFile = async (
  file: File | null | undefined
): Promise<{issues: SharedDocumentIssue[]; checked?: CheckedFile}> => {
  if (!hasFile(file)) return {issues: [SharedDocumentIssueConst.FILE_MISSING]}

  const content = new Uint8Array(await file.arrayBuffer())
  const validation = validateContentFile('document', content)
  if (validation.valid) {
    return {issues: [], checked: {file, bytes: content.length}}
  }
  return {
    issues: [
      validation.reason === 'size'
        ? SharedDocumentIssueConst.FILE_SIZE
        : SharedDocumentIssueConst.FILE_FORMAT,
    ],
  }
}

/**
 * Un echec d'effacement laisse un fichier orphelin, jamais une operation en
 * echec : la ligne est deja juste en base.
 */
const deleteFileQuietly = async (key: string): Promise<void> => {
  try {
    await getContentFileStorage().delete(key)
  } catch (error) {
    logger.warn('[SHARED-DOCUMENT] Fichier laisse orphelin', {
      key,
      error: (error as Error).message,
    })
  }
}

/**
 * Depose un document partage (critere 1, ADR 069).
 *
 * Ordre : `safeParse` -> controle d'acces -> titre, categorie active du
 * domaine `document` et PDF par signature binaire, **avant toute ecriture**
 * -> identifiant genere par le serveur -> fichier ecrit -> ligne inseree. Si
 * l'insertion echoue, le fichier tout juste ecrit est efface et l'erreur
 * propagee : une ligne ne pointe jamais vers un fichier absent.
 */
export const publishSharedDocumentService = async (input: {
  organizationId: string
  title: string
  categoryId: string
  file?: File | null
}): Promise<SharedDocumentPublishResult> => {
  const parsed = publishSharedDocumentServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, title, categoryId} = parsed.data
  await requireManager(organizationId)

  const category = await checkCategory(organizationId, categoryId)
  const file = await checkFile(input.file)
  const issues = [...checkTitle(title), ...category.issues, ...file.issues]
  if (issues.length > 0 || !file.checked) {
    return {status: 'rejected', issues}
  }

  const documentId = crypto.randomUUID()
  const fileKey = buildSharedDocumentFileKey(organizationId, documentId)
  await getContentFileStorage().upload(file.checked.file, fileKey)

  try {
    const created = await withTenant(organizationId, () =>
      createSharedDocumentDao({
        id: documentId,
        organizationId,
        title,
        categoryId,
        fileKey,
        fileBytes: file.checked?.bytes ?? 0,
      })
    )
    return {
      status: 'published',
      document: {
        id: created.id,
        title: created.title,
        categoryId: created.categoryId,
        categoryName: category.name ?? '',
        fileBytes: created.fileBytes,
        createdAt: created.createdAt,
      },
    }
  } catch (error) {
    await deleteFileQuietly(fileKey)
    throw error
  }
}

/**
 * Retire un document, definitivement (critere 5) : la ligne d'abord, le
 * fichier ensuite — un echec disque ne laisse qu'un orphelin journalise,
 * jamais une ligne sans fichier.
 */
export const deleteSharedDocumentService = async (input: {
  organizationId: string
  documentId: string
}): Promise<SharedDocumentDeleteResult> => {
  const parsed = sharedDocumentReferenceServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, documentId} = parsed.data
  await requireManager(organizationId)

  const removed = await withTenant(organizationId, () =>
    deleteSharedDocumentDao(documentId)
  )
  if (!removed) {
    throw new NotFoundError(DOCUMENT_NOT_FOUND)
  }

  await deleteFileQuietly(removed.fileKey)

  return {status: 'deleted', title: removed.title}
}

/**
 * Les documents de l'association pour l'espace membre (critere 2), rangés
 * par categorie puis du plus recent au plus ancien. Tout membre authentifie
 * de **cette** association.
 */
export const getSharedDocumentsForMemberService = async (
  organizationId: string
): Promise<SharedDocumentDTO[]> => {
  const parsed = sharedDocumentOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireAction(
    parsed.data,
    ActionIdConst.SHARED_DOCUMENT_READ,
    READ_DENIED
  )

  const rows = await withTenant(parsed.data, () =>
    listSharedDocumentsDao(parsed.data, 'category')
  )
  return rows.map((row) => toMemberDto(row))
}

/** Liste de gestion du bureau, du plus recent au plus ancien. */
export const getSharedDocumentsForBureauService = async (
  organizationId: string
): Promise<BureauSharedDocumentDTO[]> => {
  const parsed = sharedDocumentOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireManager(parsed.data)

  const rows = await withTenant(parsed.data, () =>
    listSharedDocumentsDao(parsed.data, 'recent')
  )
  return rows.map((row) => toBureauDto(row))
}

/**
 * Le fichier d'un document, pour la route authentifiee `GET
 * /api/documents/[id]` (ADR 069 §4). La cle est relue en base sous le tenant
 * du domaine, jamais tiree de la requete : un identifiant d'une autre
 * association ou d'un document retire ne rend rien.
 *
 * Sans session : `UnauthenticatedError` (401). Sans l'action de lecture dans
 * **cette** association : `AuthorizationError` (403) — defense en profondeur
 * au-dela de l'ADR 034. Ligne absente : `NotFoundError` (404).
 */
export const readSharedDocumentFileService = async (
  organizationId: string,
  documentId: string
): Promise<SharedDocumentFile> => {
  const parsed = sharedDocumentReferenceServiceSchema.safeParse({
    organizationId,
    documentId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new UnauthenticatedError()
  }
  if (
    !canPerformAction(
      authUser,
      parsed.data.organizationId,
      ActionIdConst.SHARED_DOCUMENT_READ
    )
  ) {
    throw new AuthorizationError(READ_DENIED)
  }

  const row = await withTenant(parsed.data.organizationId, () =>
    getSharedDocumentByIdDao(parsed.data.documentId)
  )
  if (!row) {
    throw new NotFoundError(DOCUMENT_NOT_FOUND)
  }

  return {
    content: await getContentFileStorage().download(row.fileKey),
    title: row.title,
  }
}

/**
 * L'utilisateur connecte peut-il gerer les documents partages de cette
 * association ? Sert l'interface ; chaque mutation reverifie.
 */
export const canManageSharedDocumentsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = sharedDocumentOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.SHARED_DOCUMENT_MANAGE
  )
}
