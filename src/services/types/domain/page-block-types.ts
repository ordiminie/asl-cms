import {z} from 'zod'

import {
  buildContentFileKey,
  ContentFileScopeConst,
  isContentFileKeyAllowed,
} from './content-file-types'

/**
 * Blocs typés d'une page CMS (ADR 007, ADR 019).
 *
 * Module isomorphe : la forme d'un bloc vit ici, en code, jamais en colonnes
 * de base. `content_block.data` est du `jsonb` libre ; c'est ce schéma qui en
 * garantit la forme **à l'écriture**. À la lecture, un `type` absent d'ici est
 * simplement ignoré par le rendu public (critère 9), jamais une erreur.
 */

export const PageBlockTypeConst = {
  TEXT: 'text',
  IMAGE: 'image',
  PDF: 'pdf',
  GALLERY: 'gallery',
  CALLOUT: 'callout',
} as const

export type PageBlockType =
  (typeof PageBlockTypeConst)[keyof typeof PageBlockTypeConst]

export const PAGE_BLOCK_TYPES: readonly PageBlockType[] = [
  PageBlockTypeConst.TEXT,
  PageBlockTypeConst.IMAGE,
  PageBlockTypeConst.PDF,
  PageBlockTypeConst.GALLERY,
  PageBlockTypeConst.CALLOUT,
]

const galleryImageSchema = z.object({
  fileKey: z.string().min(1),
  alt: z.string().default(''),
})

/**
 * Les champs « obligatoires pour publier » (alt d'une image, titre d'un PDF)
 * sont acceptés vides ici : un brouillon s'enregistre incomplet. C'est
 * `validatePageBlocksForPublication` qui les exige, au moment de publier.
 */
export const pageBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(PageBlockTypeConst.TEXT),
    markdown: z.string().default(''),
  }),
  z.object({
    type: z.literal(PageBlockTypeConst.IMAGE),
    fileKey: z.string().min(1).nullable().default(null),
    alt: z.string().default(''),
    caption: z.string().default(''),
  }),
  z.object({
    type: z.literal(PageBlockTypeConst.PDF),
    fileKey: z.string().min(1).nullable().default(null),
    title: z.string().default(''),
    fileName: z.string().default(''),
    fileSize: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal(PageBlockTypeConst.GALLERY),
    images: z.array(galleryImageSchema).default([]),
  }),
  z.object({
    type: z.literal(PageBlockTypeConst.CALLOUT),
    title: z.string().default(''),
    markdown: z.string().default(''),
  }),
])

export type PageBlockData = z.infer<typeof pageBlockSchema>

/** Un bloc tel qu'il est stocké : type en texte libre, données en `jsonb`. */
export type StoredPageBlock = {
  id: string
  type: string
  rank: number
  data: unknown
}

/**
 * Segments servis à la racine du produit, interdits comme slug de page
 * (ADR 020). Les pages CMS vivent à la racine (`/{slug}`) : une page nommée
 * `admin` ou `api` masquerait une route du socle.
 *
 * ⚠️ Toute story qui ajoute un segment racine à `src/app/[locale]/` doit
 * l'ajouter ici **dans le même commit**, sinon la collision se découvre en
 * production.
 */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  'account',
  'actualites',
  'admin',
  'annonces',
  'api',
  'auth-error',
  'blog',
  'bureau',
  'checkout',
  'contact',
  'dashboard',
  'docs',
  'login',
  'logout',
  'modules',
  'pricing',
  'pricing_old',
  'privacy',
  'register',
  'reset-password',
  'terms',
  'verify-request',
  'voirie',
  'vote',
]

export const isPageSlugReserved = (slug: string): boolean =>
  RESERVED_PAGE_SLUGS.includes(slug.trim().toLowerCase())

/** Codes de refus d'une publication : champs obligatoires seulement à publier. */
export const PageBlockPublicationErrorConst = {
  MISSING_IMAGE_ALT: 'missing_image_alt',
  MISSING_GALLERY_ALT: 'missing_gallery_alt',
  MISSING_PDF_TITLE: 'missing_pdf_title',
} as const

export type PageBlockPublicationError =
  (typeof PageBlockPublicationErrorConst)[keyof typeof PageBlockPublicationErrorConst]

export type PageBlockPublicationIssue = {
  rank: number
  code: PageBlockPublicationError
}

/**
 * Contrôle « obligatoire pour publier » (design system §4) : un bloc sans
 * fichier est simplement omis du rendu, donc sans reproche ; un bloc **avec**
 * fichier doit porter son texte alternatif ou son titre.
 */
export const validatePageBlocksForPublication = (
  blocks: readonly {rank: number; data: PageBlockData}[]
): PageBlockPublicationIssue[] => {
  const issues: PageBlockPublicationIssue[] = []

  for (const {rank, data} of blocks) {
    if (
      data.type === PageBlockTypeConst.IMAGE &&
      data.fileKey &&
      data.alt.trim() === ''
    ) {
      issues.push({
        rank,
        code: PageBlockPublicationErrorConst.MISSING_IMAGE_ALT,
      })
    }

    if (
      data.type === PageBlockTypeConst.PDF &&
      data.fileKey &&
      data.title.trim() === ''
    ) {
      issues.push({
        rank,
        code: PageBlockPublicationErrorConst.MISSING_PDF_TITLE,
      })
    }

    if (
      data.type === PageBlockTypeConst.GALLERY &&
      data.images.some((image) => image.alt.trim() === '')
    ) {
      issues.push({
        rank,
        code: PageBlockPublicationErrorConst.MISSING_GALLERY_ALT,
      })
    }
  }

  return issues
}

/**
 * Fichiers d'un bloc de page (ADR 004, ADR 015) : images et documents.
 *
 * Meme discipline que l'identite d'association : le format est juge sur la
 * **signature binaire**, jamais sur l'extension ni sur le type declare par le
 * navigateur ; la cle est generee par le serveur, prefixee par l'association.
 */
export type PageFileKind = 'image' | 'document'

export type PageFileFormat = 'png' | 'webp' | 'jpeg' | 'pdf'

export const PAGE_FILE_CONTENT_TYPES: Record<PageFileFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
}

export const PAGE_FILE_ACCEPTED_FORMATS: Record<
  PageFileKind,
  readonly PageFileFormat[]
> = {
  image: ['png', 'webp', 'jpeg'],
  document: ['pdf'],
}

/** Poids maximal par nature de fichier, en octets. */
export const PAGE_FILE_MAX_BYTES: Record<PageFileKind, number> = {
  image: 5 * 1024 * 1024,
  document: 10 * 1024 * 1024,
}

export type PageFileValidation =
  | {valid: true; format: PageFileFormat}
  | {valid: false; reason: 'format'}
  | {valid: false; reason: 'size'; size: number; maxBytes: number}

const startsWithSignature = (
  content: Uint8Array,
  signature: number[],
  offset = 0
) =>
  content.length >= offset + signature.length &&
  signature.every((value, index) => content[offset + index] === value)

const PAGE_PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PAGE_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]
const PAGE_WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]
const PAGE_JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const PAGE_PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

/** Format d'un fichier de bloc, reconnu a sa signature binaire seule. */
export const detectPageFileFormat = (
  content: Uint8Array
): PageFileFormat | undefined => {
  if (startsWithSignature(content, PAGE_PNG_SIGNATURE)) return 'png'
  if (
    startsWithSignature(content, PAGE_RIFF_SIGNATURE) &&
    startsWithSignature(content, PAGE_WEBP_SIGNATURE, 8)
  ) {
    return 'webp'
  }
  if (startsWithSignature(content, PAGE_JPEG_SIGNATURE)) return 'jpeg'
  if (startsWithSignature(content, PAGE_PDF_SIGNATURE)) return 'pdf'
  return undefined
}

export const validatePageBlockFile = (
  kind: PageFileKind,
  content: Uint8Array
): PageFileValidation => {
  const maxBytes = PAGE_FILE_MAX_BYTES[kind]
  if (content.length > maxBytes) {
    return {valid: false, reason: 'size', size: content.length, maxBytes}
  }

  const format = detectPageFileFormat(content)
  if (
    !format ||
    !(PAGE_FILE_ACCEPTED_FORMATS[kind] as readonly string[]).includes(format)
  ) {
    return {valid: false, reason: 'format'}
  }

  return {valid: true, format}
}

const PAGE_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Cle de stockage generee par le serveur :
 * `{organizationId}/pages/{pageId}/{blockId}-{uuid}.{ext}`. Enveloppe de la
 * chaine de fichiers de contenu partagee (ADR 023) : la forme de la cle est
 * inchangee depuis s04, octet pour octet.
 */
export const buildPageBlockFileKey = (
  organizationId: string,
  pageId: string,
  blockId: string,
  format: PageFileFormat
): string => {
  if (!PAGE_UUID_PATTERN.test(blockId)) {
    throw new Error('Invalid identifier for a page block file key')
  }

  return buildContentFileKey(
    organizationId,
    ContentFileScopeConst.PAGES,
    pageId,
    blockId,
    format
  )
}

/**
 * Une cle de fichier de page n'est servie que sous le prefixe
 * `{organizationId}/pages/` de l'association resolue par le domaine.
 * Enveloppe de `isContentFileKeyAllowed`, restreinte a la portee `pages`.
 */
export const isPageBlockFileKeyAllowed = (
  organizationId: string,
  key: string
): boolean =>
  isContentFileKeyAllowed(organizationId, key, [ContentFileScopeConst.PAGES])
