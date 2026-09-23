import {NewsModel} from '@/db/models/news-model'

import {
  ContentFileScopeConst,
  isContentFileKeyAllowed,
} from './content-file-types'

/**
 * Types de domaine des actualites (s05, ADR 023). La presentation ne connait
 * que ceux-ci, jamais les modeles Drizzle.
 */

export type News = NewsModel
export type NewsStatus = News['status']

export const NewsStatusConst = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const satisfies Record<string, NewsStatus>

export type NewsDTO = {
  id: string
  organizationId: string
  /** Nul tant que l'actualite n'a jamais ete enregistree avec un titre. */
  slug: string | null
  title: string
  /** Date ISO `YYYY-MM-DD`, sans heure ni fuseau. */
  publishedOn: string
  imageKey: string | null
  imageAlt: string
  content: string
  status: NewsStatus
  createdAt: Date
  updatedAt: Date
}

/** Une page de liste : les lignes, et de quoi ecrire « Page x sur y ». */
export type NewsListPageDTO = {
  items: NewsDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Tailles de page d'affichage (ADR 023, §4) : des conventions de
 * presentation, pas des parametres d'association.
 */
export const NEWS_PUBLIC_PAGE_SIZE = 10
export const NEWS_BUREAU_PAGE_SIZE = 25

/** Codes de refus d'une publication : champs obligatoires seulement a publier. */
export const NewsPublicationErrorConst = {
  MISSING_TITLE: 'missing_title',
  MISSING_IMAGE_ALT: 'missing_image_alt',
} as const

export type NewsPublicationError =
  (typeof NewsPublicationErrorConst)[keyof typeof NewsPublicationErrorConst]

export type NewsSavedResult = {status: 'saved'; news: NewsDTO}

/**
 * Enregistrer une actualite **deja publiee**, c'est la republier aussitot :
 * elle doit donc satisfaire les memes exigences qu'a la publication, faute de
 * quoi le site public servirait un titre vide ou une image sans texte
 * alternatif. Un brouillon, lui, garde le droit d'etre incomplet.
 */
export type NewsMutationResult =
  NewsSavedResult | {status: 'rejected'; issues: NewsPublicationError[]}

export type NewsPublicationResult =
  | {status: 'published'; news: NewsDTO}
  | {status: 'rejected'; issues: NewsPublicationError[]}

export type NewsUnpublicationResult = {status: 'unpublished'; news: NewsDTO}

export type NewsImageUpload =
  | {status: 'uploaded'; key: string; fileName: string; fileSize: number}
  | {status: 'rejected'; reason: 'format'}
  | {status: 'rejected'; reason: 'size'; size: number; maxBytes: number}

/**
 * Une cle d'image rendue par le formulaire n'est ecrite que si elle vit sous
 * `{organisation}/news/{actualite}/` — donc sous une cle que le serveur a
 * lui-meme generee au depot pour **cette** actualite. Le depot ne touche plus
 * la ligne : c'est ici que la cle entre, et c'est donc ici qu'elle se verifie.
 */
export const isNewsImageKeyAllowed = (
  organizationId: string,
  newsId: string,
  key: string
): boolean =>
  key.startsWith(
    `${organizationId}/${ContentFileScopeConst.NEWS}/${newsId}/`
  ) &&
  isContentFileKeyAllowed(organizationId, key, [ContentFileScopeConst.NEWS])

/** Nombre de pages d'une liste ; une liste vide a quand meme sa page 1. */
export const countNewsPages = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / pageSize))

/** Longueur maximale d'une adresse, celle de `pageSlugSchema`. */
export const NEWS_SLUG_MAX_LENGTH = 80

/**
 * Adresse de repli quand le titre ne contient aucune lettre ni aucun chiffre
 * (« !!! ») : une valeur technique d'URL, pas un libelle.
 */
export const NEWS_SLUG_FALLBACK = 'actualite'

/**
 * Adresse derivee d'un titre : accents retires (« Fête » -> `fete`),
 * minuscules, tout autre caractere remplace par un tiret, sans tiret en bordure
 * ni double — la forme de `pageSlugSchema`.
 */
export const slugifyNewsTitle = (title: string): string => {
  const slug = title
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, NEWS_SLUG_MAX_LENGTH)
    .replace(/-+$/, '')

  return slug === '' ? NEWS_SLUG_FALLBACK : slug
}

/**
 * Candidat numero `attempt` pour une adresse deja prise : `base`, puis
 * `base-2`, `base-3`… en raccourcissant la base pour tenir dans la longueur
 * maximale.
 */
export const newsSlugCandidate = (base: string, attempt: number): string => {
  if (attempt <= 1) return base

  const suffix = `-${attempt}`
  const head = base
    .slice(0, NEWS_SLUG_MAX_LENGTH - suffix.length)
    .replace(/-+$/, '')
  return `${head}${suffix}`
}

/**
 * Controle « obligatoire pour publier » : un titre, et un texte alternatif si
 * une image est posee. Jamais exige pour enregistrer un brouillon.
 */
export const validateNewsForPublication = (news: {
  title: string
  imageKey: string | null
  imageAlt: string
}): NewsPublicationError[] => {
  const issues: NewsPublicationError[] = []
  if (news.title.trim() === '') {
    issues.push(NewsPublicationErrorConst.MISSING_TITLE)
  }
  if (news.imageKey && news.imageAlt.trim() === '') {
    issues.push(NewsPublicationErrorConst.MISSING_IMAGE_ALT)
  }
  return issues
}
