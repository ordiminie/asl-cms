import {remark} from 'remark'
import remarkHtml from 'remark-html'

import {
  pageBlockSchema,
  PageBlockTypeConst,
} from '@/services/types/domain/page-block-types'

/**
 * Rendu public d'un bloc de page (ADR 019).
 *
 * Fonction **pure et synchrone**, sans horloge ni requête : elle peut donc
 * vivre dans un scope `'use cache'`, contrairement à `MDXContent` qui appelle
 * `await connection()`. Elle rend `null` — jamais une exception — pour un type
 * de bloc inconnu ou une donnée hors forme : une page déjà en base créée par
 * une version antérieure du code doit continuer de s'afficher (critère 9).
 */

/** Route de lecture des fichiers de bloc (tâche 4 du plan s04). */
export const PAGE_BLOCK_FILE_ROUTE = '/api/pages/files'

/**
 * Balises autorisées : exactement celles que la barre réduite du design
 * system produit (gras, italique, titre 2/3, liste, lien). Pas le schéma GFM
 * par défaut — ni tableau, ni code, ni attribut de style.
 */
const RESTRICTED_SANITIZE_SCHEMA = {
  tagNames: [
    'p',
    'br',
    'strong',
    'em',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
  ],
  attributes: {a: ['href', 'title']},
  protocols: {href: ['http', 'https', 'mailto']},
  clobber: [],
  strip: ['script'],
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;')

const fileUrl = (key: string): string =>
  `${PAGE_BLOCK_FILE_ROUTE}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`

/**
 * Rend du markdown restreint en HTML sanitise. **Un seul** schema de
 * sanitisation pour tout le texte riche du produit (ADR 019, ADR 023) : le
 * bloc texte d'une page de s04 et le contenu d'une actualite de s05 passent
 * par cette fonction, jamais par une seconde liste de balises autorisees.
 *
 * Pure et synchrone, sans horloge ni requete : utilisable dans un scope
 * `'use cache'`.
 */
export const renderRestrictedMarkdown = (markdown: string): string =>
  String(
    remark()
      .use(remarkHtml, {sanitize: RESTRICTED_SANITIZE_SCHEMA})
      .processSync(markdown)
  ).trim()

const renderText = (markdown: string): string | null => {
  if (markdown.trim() === '') return null
  const html = renderRestrictedMarkdown(markdown)
  return html === '' ? null : `<div class="page-block-text">${html}</div>`
}

const renderImage = (
  fileKey: string | null,
  alt: string,
  caption: string
): string | null => {
  if (!fileKey) return null

  const figcaption =
    caption.trim() === ''
      ? ''
      : `<figcaption>${escapeHtml(caption)}</figcaption>`

  return `<figure class="page-block-image"><img src="${escapeHtml(
    fileUrl(fileKey)
  )}" alt="${escapeHtml(alt)}" loading="lazy" />${figcaption}</figure>`
}

const renderPdf = (fileKey: string | null, title: string): string | null => {
  if (!fileKey || title.trim() === '') return null

  return `<p class="page-block-pdf"><a href="${escapeHtml(
    fileUrl(fileKey)
  )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    title
  )} (PDF, ouverture dans un nouvel onglet)</a></p>`
}

const renderGallery = (
  images: readonly {fileKey: string; alt: string}[]
): string | null => {
  if (images.length === 0) return null

  const tiles = images
    .map(
      (image) =>
        `<li><img src="${escapeHtml(fileUrl(image.fileKey))}" alt="${escapeHtml(
          image.alt
        )}" loading="lazy" /></li>`
    )
    .join('')

  return `<ul class="page-block-gallery">${tiles}</ul>`
}

const renderCallout = (title: string, markdown: string): string | null => {
  const heading = title.trim() === '' ? '' : `<h2>${escapeHtml(title)}</h2>`
  const body = markdown.trim() === '' ? '' : renderRestrictedMarkdown(markdown)

  if (heading === '' && body === '') return null

  return `<aside class="page-block-callout">${heading}${body}</aside>`
}

/**
 * Rend un bloc stocké en HTML sanitisé, ou `null` s'il ne doit pas paraître :
 * type inconnu, donnée hors forme, ou bloc incomplet (fichier absent, galerie
 * vide) — omis du rendu, jamais affiché en boîte vide.
 */
export const renderPageBlock = (block: {
  type: string
  data: unknown
}): string | null => {
  const parsed = pageBlockSchema.safeParse({
    ...(typeof block.data === 'object' && block.data !== null
      ? block.data
      : {}),
    type: block.type,
  })
  if (!parsed.success) return null

  const data = parsed.data
  switch (data.type) {
    case PageBlockTypeConst.TEXT: {
      return renderText(data.markdown)
    }
    case PageBlockTypeConst.IMAGE: {
      return renderImage(data.fileKey, data.alt, data.caption)
    }
    case PageBlockTypeConst.PDF: {
      return renderPdf(data.fileKey, data.title)
    }
    case PageBlockTypeConst.GALLERY: {
      return renderGallery(data.images)
    }
    case PageBlockTypeConst.CALLOUT: {
      return renderCallout(data.title, data.markdown)
    }
  }
}
