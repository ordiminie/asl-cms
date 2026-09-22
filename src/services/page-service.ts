import 'server-only'

import {
  createPageDao,
  getPageByIdDao,
  getPageBySlugDao,
  getPagesByOrganizationDao,
  PageBlockRow,
  PageWithBlocksRow,
  ReorderedPageBlock,
  reorderPageBlocksTxnDao,
  updatePageDao,
  updatePageStatusDao,
} from '@/db/repositories/page-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canManageAssociation} from './authorization/association-authorization'
import {
  getContentFileStorage,
  readContentFileService,
} from './content-file-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  buildPageBlockFileKey,
  isPageBlockFileKeyAllowed,
  isPageSlugReserved,
  PAGE_FILE_CONTENT_TYPES,
  PageBlockData,
  pageBlockSchema,
  PageFileKind,
  validatePageBlockFile,
  validatePageBlocksForPublication,
} from './types/domain/page-block-types'
import {
  PAGE_SLUG_UNAVAILABLE,
  PageDTO,
  PageMutationResult,
  PagePublicationResult,
  PageUnpublicationResult,
  PageWithBlocksDTO,
} from './types/domain/page-types'
import {
  createPageServiceSchema,
  pageOrganizationIdSchema,
  pageStatusChangeServiceSchema,
  readPageBlockFileServiceSchema,
  readPageBySlugServiceSchema,
  updatePageServiceSchema,
  uploadPageBlockFileServiceSchema,
} from './validation/page-validation'

const MANAGE_DENIED = "Seul le bureau de l'association peut gérer les pages"

const toPageDto = (row: {
  id: string
  organizationId: string
  slug: string
  title: string
  status: PageDTO['status']
  createdAt: Date
  updatedAt: Date
}): PageDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  slug: row.slug,
  title: row.title,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const toPageWithBlocksDto = (row: PageWithBlocksRow): PageWithBlocksDTO => ({
  ...toPageDto(row),
  blocks: row.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    rank: block.rank,
    data: block.data,
  })),
})

const requirePageManager = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (!canPerformAction(authUser, organizationId, ActionIdConst.PAGE_MANAGE)) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

/**
 * Le slug est refuse pour une seule et meme raison affichee (ADR 020) : il est
 * deja pris dans cette association, ou il masquerait une route du socle. Deux
 * associations gardent le droit au meme slug : la recherche est scopee.
 */
const isSlugAvailable = async (
  organizationId: string,
  slug: string,
  currentPageId?: string
): Promise<boolean> => {
  if (isPageSlugReserved(slug)) return false

  const existing = await withTenant(organizationId, () =>
    getPageBySlugDao(organizationId, slug)
  )
  return !existing || existing.id === currentPageId
}

type BlockInput = {id?: string; type?: string; data: unknown}

/**
 * Prepare la liste ordonnee a ecrire. Le rang vient de la **position dans le
 * tableau**, jamais d'un champ envoye par le client : souris et clavier
 * produisent donc exactement le meme resultat (critere 8).
 *
 * Un bloc dont le type est absent du schema n'est accepte que s'il existait
 * deja sur cette page (ADR 019 : le bureau ne peut pas creer un sixieme type,
 * mais il doit pouvoir enregistrer une page qui en contient un — sinon la page
 * devient impossible a modifier). Sa donnee est reprise **en base**, pas dans
 * la requete.
 */
const prepareBlocks = (
  blocks: BlockInput[],
  storedBlocks: PageBlockRow[]
): ReorderedPageBlock[] =>
  blocks.map((block, index) => {
    const parsed = pageBlockSchema.safeParse(block.data)
    if (parsed.success) {
      return {
        id: block.id,
        type: parsed.data.type,
        rank: index,
        data: parsed.data,
      }
    }

    const stored = storedBlocks.find((candidate) => candidate.id === block.id)
    if (!stored) {
      throw new ValidationParsedZodError(parsed.error)
    }

    return {id: stored.id, type: stored.type, rank: index, data: stored.data}
  })

/**
 * Cree une page en brouillon (s04). Ordre : `safeParse` -> controle d'acces ->
 * disponibilite du slug -> ecriture sous le scope de l'association. Un slug
 * indisponible est rendu comme un resultat, pour devenir un message de champ.
 */
export const createPageService = async (input: {
  organizationId: string
  title: string
  slug: string
  blocks: BlockInput[]
}): Promise<PageMutationResult> => {
  const parsed = createPageServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requirePageManager(parsed.data.organizationId)

  if (!(await isSlugAvailable(parsed.data.organizationId, parsed.data.slug))) {
    return {status: 'rejected', error: PAGE_SLUG_UNAVAILABLE}
  }

  const blocks = prepareBlocks(parsed.data.blocks, [])

  const saved = await withTenant(parsed.data.organizationId, async () => {
    const created = await createPageDao({
      organizationId: parsed.data.organizationId,
      slug: parsed.data.slug,
      title: parsed.data.title,
    })
    const savedBlocks = await reorderPageBlocksTxnDao(created.id, blocks)
    return {...created, blocks: savedBlocks}
  })

  return {status: 'saved', page: toPageWithBlocksDto(saved)}
}

/**
 * Enregistre le brouillon d'une page : titre, slug et liste ordonnee de blocs.
 * N'exige **jamais** les champs « obligatoires pour publier » — un brouillon
 * incomplet doit pouvoir s'enregistrer.
 */
export const updatePageService = async (input: {
  organizationId: string
  pageId: string
  title: string
  slug: string
  blocks: BlockInput[]
}): Promise<PageMutationResult> => {
  const parsed = updatePageServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requirePageManager(parsed.data.organizationId)

  const current = await withTenant(parsed.data.organizationId, () =>
    getPageByIdDao(parsed.data.pageId)
  )
  if (!current) {
    throw new NotFoundError('Page introuvable')
  }

  if (
    !(await isSlugAvailable(
      parsed.data.organizationId,
      parsed.data.slug,
      parsed.data.pageId
    ))
  ) {
    return {status: 'rejected', error: PAGE_SLUG_UNAVAILABLE}
  }

  const blocks = prepareBlocks(parsed.data.blocks, current.blocks)

  const saved = await withTenant(parsed.data.organizationId, async () => {
    const updated = await updatePageDao(parsed.data.pageId, {
      slug: parsed.data.slug,
      title: parsed.data.title,
    })
    const savedBlocks = await reorderPageBlocksTxnDao(
      parsed.data.pageId,
      blocks
    )
    return {...updated, blocks: savedBlocks}
  })

  return {status: 'saved', page: toPageWithBlocksDto(saved)}
}

/**
 * Publie une page. Seule cette fonction exige les champs « obligatoires pour
 * publier » (design system §4) : texte alternatif d'une image ou d'une
 * vignette, titre d'un document. Un bloc de type inconnu, ignore au rendu,
 * n'est pas non plus un obstacle a la publication.
 */
export const publishPageService = async (input: {
  organizationId: string
  pageId: string
}): Promise<PagePublicationResult> => {
  const parsed = pageStatusChangeServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requirePageManager(parsed.data.organizationId)

  const current = await withTenant(parsed.data.organizationId, () =>
    getPageByIdDao(parsed.data.pageId)
  )
  if (!current) {
    throw new NotFoundError('Page introuvable')
  }

  const knownBlocks: {rank: number; data: PageBlockData}[] = []
  for (const block of current.blocks) {
    const parsedBlock = pageBlockSchema.safeParse(block.data)
    if (parsedBlock.success) {
      knownBlocks.push({rank: block.rank, data: parsedBlock.data})
    }
  }

  const issues = validatePageBlocksForPublication(knownBlocks)
  if (issues.length > 0) {
    return {status: 'rejected', issues}
  }

  const published = await withTenant(parsed.data.organizationId, () =>
    updatePageStatusDao(parsed.data.pageId, 'published')
  )

  return {status: 'published', page: toPageDto(published)}
}

/**
 * Retire une page du site public **sans la supprimer** : son contenu reste
 * intact, la republier la restaure a l'identique (critere 3).
 */
export const unpublishPageService = async (input: {
  organizationId: string
  pageId: string
}): Promise<PageUnpublicationResult> => {
  const parsed = pageStatusChangeServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requirePageManager(parsed.data.organizationId)

  const current = await withTenant(parsed.data.organizationId, () =>
    getPageByIdDao(parsed.data.pageId)
  )
  if (!current) {
    throw new NotFoundError('Page introuvable')
  }

  const unpublished = await withTenant(parsed.data.organizationId, () =>
    updatePageStatusDao(parsed.data.pageId, 'unpublished')
  )

  return {status: 'unpublished', page: toPageDto(unpublished)}
}

/** Liste de gestion du bureau, triee par derniere modification decroissante. */
export const getPagesForBureauService = async (
  organizationId: string
): Promise<PageDTO[]> => {
  const parsed = pageOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError('Identifiant d association invalide')
  }

  await requirePageManager(parsed.data)

  const rows = await withTenant(parsed.data, () =>
    getPagesByOrganizationDao(parsed.data)
  )
  return rows.map((row) => toPageDto(row))
}

/** Une page du bureau, blocs compris, pour l'editeur et l'apercu. */
export const getPageForBureauService = async (
  organizationId: string,
  pageId: string
): Promise<PageWithBlocksDTO> => {
  const parsed = pageStatusChangeServiceSchema.safeParse({
    organizationId,
    pageId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requirePageManager(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    getPageByIdDao(parsed.data.pageId)
  )
  if (!row) {
    throw new NotFoundError('Page introuvable')
  }

  return toPageWithBlocksDto(row)
}

/**
 * Lecture d'une page par son slug pour le site public.
 *
 * **Sans controle d'autorisation, et c'est delibere** : une page publiee
 * s'adresse aux visiteurs. Le statut est rendu tel quel ; c'est l'appelant qui
 * decide d'afficher un brouillon (apercu du bureau) ou de rendre 404.
 */
export const getPageBySlugService = async (
  organizationId: string,
  slug: string
): Promise<PageWithBlocksDTO | undefined> => {
  const parsed = readPageBySlugServiceSchema.safeParse({organizationId, slug})
  if (!parsed.success) {
    return undefined
  }

  const row = await withTenant(parsed.data.organizationId, () =>
    getPageBySlugDao(parsed.data.organizationId, parsed.data.slug)
  )
  return row ? toPageWithBlocksDto(row) : undefined
}

/**
 * L'utilisateur connecte peut-il gerer les pages de cette association ? Sert
 * l'interface (menu, boutons, apercu d'un brouillon) ; chaque mutation
 * reverifie de son cote.
 */
export const canManagePagesService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = pageOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canManageAssociation(authUser, parsed.data)
}

export type PageBlockFileUpload =
  | {
      status: 'uploaded'
      key: string
      fileName: string
      fileSize: number
      contentType: string
    }
  | {status: 'rejected'; reason: 'format'}
  | {status: 'rejected'; reason: 'size'; size: number; maxBytes: number}

export type PageBlockFileContent = {content: Blob; contentType: string}

/**
 * Depose le fichier d'un bloc (image ou document).
 *
 * Ordre : `safeParse` -> controle d'acces -> la page appartient bien a cette
 * association -> validation par **signature binaire** -> ecriture sous une cle
 * generee par le serveur. Un fichier refuse est rendu comme un resultat, sans
 * rien ecrire.
 */
export const uploadPageBlockFileService = async (input: {
  organizationId: string
  pageId: string
  blockId: string
  kind: PageFileKind
  file: File
}): Promise<PageBlockFileUpload> => {
  const parsed = uploadPageBlockFileServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requirePageManager(parsed.data.organizationId)

  const owningPage = await withTenant(parsed.data.organizationId, () =>
    getPageByIdDao(parsed.data.pageId)
  )
  if (!owningPage) {
    throw new NotFoundError('Page introuvable')
  }

  const content = new Uint8Array(await input.file.arrayBuffer())
  const validation = validatePageBlockFile(parsed.data.kind, content)
  if (!validation.valid) {
    return validation.reason === 'size'
      ? {
          status: 'rejected',
          reason: 'size',
          size: validation.size,
          maxBytes: validation.maxBytes,
        }
      : {status: 'rejected', reason: 'format'}
  }

  const key = buildPageBlockFileKey(
    parsed.data.organizationId,
    parsed.data.pageId,
    parsed.data.blockId,
    validation.format
  )
  await getContentFileStorage().upload(input.file, key)

  return {
    status: 'uploaded',
    key,
    fileName: input.file.name,
    fileSize: content.length,
    contentType: PAGE_FILE_CONTENT_TYPES[validation.format],
  }
}

/**
 * Lit un fichier de bloc de page. Delegue a la chaine de fichiers de contenu
 * partagee (ADR 023), restreinte ici a la portee `pages`.
 *
 * **Sans controle d'autorisation, et c'est delibere** : ces fichiers
 * s'affichent sur le site public. La cle **vient de la requete** : elle est
 * validee contre le prefixe `{organizationId}/pages/` de l'association resolue
 * par le domaine avant toute lecture.
 */
export const readPageBlockFileService = async (
  organizationId: string,
  key: string
): Promise<PageBlockFileContent> => {
  const parsed = readPageBlockFileServiceSchema.safeParse({
    organizationId,
    key,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  if (!isPageBlockFileKeyAllowed(parsed.data.organizationId, parsed.data.key)) {
    throw new ValidationError('Clé de fichier de page invalide')
  }

  return readContentFileService(parsed.data.organizationId, parsed.data.key)
}
