import 'server-only'

import {NewsModel} from '@/db/models/news-model'
import {
  countPublishedNewsDao,
  createNewsDao,
  getNewsByIdDao,
  getNewsBySlugDao,
  getNewsPageByOrganizationDao,
  getPublishedNewsPageDao,
  isNewsSlugTakenDao,
  NewsPageRows,
  updateNewsDao,
  updateNewsStatusDao,
} from '@/db/repositories/news-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canManageAssociation} from './authorization/association-authorization'
import {getContentFileStorage} from './content-file-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  buildContentFileKey,
  ContentFileScopeConst,
  validateContentFile,
} from './types/domain/content-file-types'
import {
  countNewsPages,
  isNewsImageKeyAllowed,
  NEWS_BUREAU_PAGE_SIZE,
  NEWS_PUBLIC_PAGE_SIZE,
  NewsDTO,
  NewsImageUpload,
  NewsListPageDTO,
  NewsMutationResult,
  NewsPublicationResult,
  NewsSavedResult,
  newsSlugCandidate,
  NewsStatusConst,
  NewsUnpublicationResult,
  slugifyNewsTitle,
  validateNewsForPublication,
} from './types/domain/news-types'
import {
  createNewsDraftServiceSchema,
  newsListServiceSchema,
  newsOrganizationIdSchema,
  newsStatusChangeServiceSchema,
  readNewsBySlugServiceSchema,
  updateNewsServiceSchema,
  uploadNewsImageServiceSchema,
} from './validation/news-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les actualités"
const NEWS_NOT_FOUND = 'Actualité introuvable'
const IMAGE_KEY_REFUSED = "Cette image n'appartient pas à cette actualité"
const NEWS_IMAGE_SLOT = 'image'
const SLUG_MAX_ATTEMPTS = 50

const toNewsDto = (row: NewsModel): NewsDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  slug: row.slug,
  title: row.title,
  publishedOn: row.publishedOn,
  imageKey: row.imageKey,
  imageAlt: row.imageAlt,
  content: row.content,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const toListPageDto = (
  result: NewsPageRows,
  page: number,
  pageSize: number
): NewsListPageDTO => ({
  items: result.rows.map((row) => toNewsDto(row)),
  page,
  pageSize,
  total: result.total,
  totalPages: countNewsPages(result.total, pageSize),
})

const requireNewsManager = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (!canPerformAction(authUser, organizationId, ActionIdConst.NEWS_MANAGE)) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

const requireNews = async (
  organizationId: string,
  newsId: string
): Promise<NewsModel> => {
  const row = await withTenant(organizationId, () => getNewsByIdDao(newsId))
  if (!row) {
    throw new NotFoundError(NEWS_NOT_FOUND)
  }
  return row
}

/**
 * Premiere adresse libre derivee du titre dans cette association : `base`,
 * puis `base-2`, `base-3`… La contrainte unique de la base tranche en dernier
 * ressort ; la boucle est bornee.
 */
const findFreeSlug = async (
  organizationId: string,
  title: string
): Promise<string> => {
  const base = slugifyNewsTitle(title)

  for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt++) {
    const candidate = newsSlugCandidate(base, attempt)
    const taken = await withTenant(organizationId, () =>
      isNewsSlugTakenDao(organizationId, candidate)
    )
    if (!taken) return candidate
  }

  throw new ValidationError('Aucune adresse libre pour cette actualité')
}

/**
 * Cree une actualite en brouillon, sans titre ni adresse. La date vient du
 * formulaire : le service ne lit pas l'horloge.
 */
export const createNewsDraftService = async (input: {
  organizationId: string
  publishedOn: string
}): Promise<NewsSavedResult> => {
  const parsed = createNewsDraftServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNewsManager(parsed.data.organizationId)

  const created = await withTenant(parsed.data.organizationId, () =>
    createNewsDao({
      organizationId: parsed.data.organizationId,
      publishedOn: parsed.data.publishedOn,
    })
  )

  return {status: 'saved', news: toNewsDto(created)}
}

/**
 * Enregistre une actualite. Un brouillon incomplet s'enregistre : les champs
 * « obligatoires pour publier » ne sont exiges que si l'actualite est **deja
 * publiee**, car l'enregistrer la republie aussitot — sans quoi vider le titre
 * ou remplacer l'image sans texte alternatif passerait en ligne.
 *
 * L'adresse est fixee au premier enregistrement qui porte un titre, puis
 * **jamais recalculee** (ADR 023) : un changement de titre garde l'URL.
 *
 * L'image est **ecrite ici et nulle part ailleurs** : le depot se contente de
 * poser le fichier et de rendre sa cle, que le formulaire garde jusqu'a
 * l'enregistrement (meme chaine que les blocs de page de s04). La cle rendue
 * est donc lue dans une requete : elle n'est ecrite que si elle appartient a
 * cette actualite.
 */
export const updateNewsService = async (input: {
  organizationId: string
  newsId: string
  title: string
  publishedOn: string
  content: string
  imageAlt: string
  imageKey: string | null
}): Promise<NewsMutationResult> => {
  const parsed = updateNewsServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {
    organizationId,
    newsId,
    title,
    publishedOn,
    content,
    imageAlt,
    imageKey,
  } = parsed.data
  await requireNewsManager(organizationId)

  if (
    imageKey !== null &&
    !isNewsImageKeyAllowed(organizationId, newsId, imageKey)
  ) {
    throw new ValidationError(IMAGE_KEY_REFUSED)
  }

  const current = await requireNews(organizationId, newsId)

  if (current.status === NewsStatusConst.PUBLISHED) {
    const issues = validateNewsForPublication({title, imageKey, imageAlt})
    if (issues.length > 0) {
      return {status: 'rejected', issues}
    }
  }

  const slug =
    current.slug === null && title !== ''
      ? await findFreeSlug(organizationId, title)
      : undefined

  const saved = await withTenant(organizationId, () =>
    updateNewsDao(newsId, {
      title,
      publishedOn,
      content,
      imageKey,
      imageAlt: imageKey === null ? '' : imageAlt,
      ...(slug === undefined ? {} : {slug}),
    })
  )

  return {status: 'saved', news: toNewsDto(saved)}
}

/**
 * Publie une actualite. Seule cette fonction exige un titre, et un texte
 * alternatif si une image est posee.
 */
export const publishNewsService = async (input: {
  organizationId: string
  newsId: string
}): Promise<NewsPublicationResult> => {
  const parsed = newsStatusChangeServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNewsManager(parsed.data.organizationId)

  const current = await requireNews(
    parsed.data.organizationId,
    parsed.data.newsId
  )

  const issues = validateNewsForPublication(current)
  if (issues.length > 0) {
    return {status: 'rejected', issues}
  }

  const published = await withTenant(parsed.data.organizationId, () =>
    updateNewsStatusDao(parsed.data.newsId, 'published')
  )

  return {status: 'published', news: toNewsDto(published)}
}

/**
 * Retire une actualite du site public **sans la supprimer** : son contenu reste
 * intact, la republier la restaure.
 */
export const unpublishNewsService = async (input: {
  organizationId: string
  newsId: string
}): Promise<NewsUnpublicationResult> => {
  const parsed = newsStatusChangeServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNewsManager(parsed.data.organizationId)
  await requireNews(parsed.data.organizationId, parsed.data.newsId)

  const unpublished = await withTenant(parsed.data.organizationId, () =>
    updateNewsStatusDao(parsed.data.newsId, 'unpublished')
  )

  return {status: 'unpublished', news: toNewsDto(unpublished)}
}

/** Liste de gestion du bureau, paginee, tous statuts confondus. */
export const getNewsForBureauService = async (
  organizationId: string,
  page: number
): Promise<NewsListPageDTO> => {
  const parsed = newsListServiceSchema.safeParse({organizationId, page})
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNewsManager(parsed.data.organizationId)

  const result = await withTenant(parsed.data.organizationId, () =>
    getNewsPageByOrganizationDao({
      organizationId: parsed.data.organizationId,
      limit: NEWS_BUREAU_PAGE_SIZE,
      offset: (parsed.data.page - 1) * NEWS_BUREAU_PAGE_SIZE,
    })
  )

  return toListPageDto(result, parsed.data.page, NEWS_BUREAU_PAGE_SIZE)
}

/** Une actualite du bureau, pour l'editeur. */
export const getNewsItemForBureauService = async (
  organizationId: string,
  newsId: string
): Promise<NewsDTO> => {
  const parsed = newsStatusChangeServiceSchema.safeParse({
    organizationId,
    newsId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNewsManager(parsed.data.organizationId)

  return toNewsDto(
    await requireNews(parsed.data.organizationId, parsed.data.newsId)
  )
}

/**
 * Liste publique paginee : les actualites **publiees** seulement.
 *
 * **Sans controle d'autorisation, et c'est delibere** : une actualite publiee
 * s'adresse aux visiteurs.
 */
export const getPublishedNewsPageService = async (
  organizationId: string,
  page: number
): Promise<NewsListPageDTO> => {
  const parsed = newsListServiceSchema.safeParse({organizationId, page})
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const result = await withTenant(parsed.data.organizationId, () =>
    getPublishedNewsPageDao({
      organizationId: parsed.data.organizationId,
      limit: NEWS_PUBLIC_PAGE_SIZE,
      offset: (parsed.data.page - 1) * NEWS_PUBLIC_PAGE_SIZE,
    })
  )

  return toListPageDto(result, parsed.data.page, NEWS_PUBLIC_PAGE_SIZE)
}

/**
 * Nombre de pages de la liste publique. Une liste vide en compte **une** : sa
 * page 1 affiche l'etat vide, elle n'est pas introuvable.
 *
 * Il existe pour que la page publique borne le numero demande **avant** de
 * lire la liste : la lecture de liste est cachee par numero de page, et un
 * numero hors bornes y creerait une entree de cache par valeur essayee. Ce
 * compte, lui, ne depend que de l'association.
 *
 * **Sans controle d'autorisation, et c'est delibere**, comme la liste
 * elle-meme.
 */
export const getPublishedNewsPageCountService = async (
  organizationId: string
): Promise<number> => {
  const parsed = newsOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const total = await withTenant(parsed.data, () =>
    countPublishedNewsDao(parsed.data)
  )

  return countNewsPages(total, NEWS_PUBLIC_PAGE_SIZE)
}

/**
 * Lecture d'une actualite par son adresse pour le site public.
 *
 * **Sans controle d'autorisation, et c'est delibere.** Le statut est rendu tel
 * quel ; c'est l'appelant qui decide d'afficher un brouillon (apercu du
 * bureau) ou de rendre 404.
 */
export const getNewsBySlugService = async (
  organizationId: string,
  slug: string
): Promise<NewsDTO | undefined> => {
  const parsed = readNewsBySlugServiceSchema.safeParse({organizationId, slug})
  if (!parsed.success) {
    return undefined
  }

  const row = await withTenant(parsed.data.organizationId, () =>
    getNewsBySlugDao(parsed.data.organizationId, parsed.data.slug)
  )
  return row ? toNewsDto(row) : undefined
}

/**
 * Depose l'image d'une actualite et rend sa cle, **sans toucher a la ligne**.
 *
 * C'est l'enregistrement qui ecrit la cle (meme chaine que les fichiers de
 * bloc de s04) : sinon, sur une actualite deja publiee, le site public
 * servirait aussitot la nouvelle image avec l'ancien texte alternatif — ou
 * sans aucun — alors que le bureau n'a encore rien valide.
 *
 * Ordre : `safeParse` -> controle d'acces -> l'actualite appartient bien a
 * cette association -> validation par **signature binaire** -> ecriture du
 * fichier sous une cle de portee `news` generee par le serveur. Un fichier
 * refuse est rendu comme un resultat, sans rien ecrire.
 */
export const uploadNewsImageService = async (input: {
  organizationId: string
  newsId: string
  file: File
}): Promise<NewsImageUpload> => {
  const parsed = uploadNewsImageServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireNewsManager(parsed.data.organizationId)
  await requireNews(parsed.data.organizationId, parsed.data.newsId)

  const content = new Uint8Array(await input.file.arrayBuffer())
  const validation = validateContentFile('image', content)
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

  const key = buildContentFileKey(
    parsed.data.organizationId,
    ContentFileScopeConst.NEWS,
    parsed.data.newsId,
    NEWS_IMAGE_SLOT,
    validation.format
  )
  await getContentFileStorage().upload(input.file, key)

  return {
    status: 'uploaded',
    key,
    fileName: input.file.name,
    fileSize: content.length,
  }
}

/**
 * L'utilisateur connecte peut-il gerer les actualites de cette association ?
 * Sert l'interface (menu, apercu d'un brouillon) ; chaque mutation reverifie.
 */
export const canManageNewsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = newsOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canManageAssociation(authUser, parsed.data)
}
