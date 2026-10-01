import type {Metadata} from 'next'

import {AccentHue} from '@/services/types/domain/association-settings-types'
import {contentFileUrl} from '@/services/types/domain/content-file-types'
import {SEO_DESCRIPTION_MAX} from '@/services/types/domain/seo-types'

/**
 * Metadonnees des pages publiques (s11, decision F du plan) : fonctions pures
 * qui appliquent la chaine de repli a des donnees deja lues. Aucune lecture,
 * aucun en-tete : `generateMetadata` lit, ces fonctions decident.
 *
 * Une description absente n'est **jamais** une chaine vide : sans valeur, pas
 * de balise, et Google choisit lui-meme un extrait.
 */

/** Ce que l'association apporte a la chaine de repli. */
export type AssociationSeoContext = {
  name: string
  /** Description de l'association (parametre), `null` si non renseignee. */
  description: string | null
  /** Version du logo televerse ; absente sans logo. */
  logoVersion: string | undefined
  hue: AccentHue
  /** Origine absolue de l'association, sans barre finale. */
  origin: string
}

export type ResolvedSeo = {
  title: string
  description?: string
  image: {url: string; alt: string}
  /** Adresse canonique absolue, **sans prefixe de locale** (decision B). */
  canonical: string
}

export type PageSeoSource = {
  slug: string
  title: string
  seoTitle: string | null
  seoDescription: string | null
  shareImageKey: string | null
  shareImageAlt: string | null
}

export type NewsSeoSource = {
  slug: string
  title: string
  content: string
  seoDescription: string | null
  imageKey: string | null
  imageAlt: string
}

export type FixedPageSeoSource = {
  /** Chemin sans prefixe de locale : `/`, `/actualites`, `/contact`… */
  path: string
  title: string
}

/** Route de l'image de repli generee (decision G). */
export const SHARE_IMAGE_ROUTE = '/api/identity/share-image'

const filled = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const withDescription = (
  seo: Omit<ResolvedSeo, 'description'>,
  description: string | undefined
): ResolvedSeo => (description ? {...seo, description} : seo)

/**
 * Adresse de l'image de repli, cle de cache comprise : elle change quand le
 * logo ou la teinte change, pas avant.
 */
export const shareImageFallbackUrl = (
  association: AssociationSeoContext
): string => {
  const query = new URLSearchParams()
  if (association.logoVersion) query.set('v', association.logoVersion)
  query.set('h', String(association.hue))
  return `${association.origin}${SHARE_IMAGE_ROUTE}?${query.toString()}`
}

const fallbackImage = (association: AssociationSeoContext) => ({
  url: shareImageFallbackUrl(association),
  alt: association.name,
})

const canonicalOf = (association: AssociationSeoContext, path: string) =>
  `${association.origin}${path}`

/** Page CMS : titre moteur -> titre ; description -> association -> aucune. */
export const resolvePageSeo = (
  page: PageSeoSource,
  association: AssociationSeoContext
): ResolvedSeo =>
  withDescription(
    {
      title: filled(page.seoTitle) ?? page.title,
      image: page.shareImageKey
        ? {
            url: `${association.origin}${contentFileUrl(page.shareImageKey)}`,
            alt: filled(page.shareImageAlt) ?? association.name,
          }
        : fallbackImage(association),
      canonical: canonicalOf(association, `/${page.slug}`),
    },
    filled(page.seoDescription) ?? filled(association.description)
  )

/** Actualite : description -> debut du texte ; image -> image de repli. */
export const resolveNewsSeo = (
  news: NewsSeoSource,
  association: AssociationSeoContext
): ResolvedSeo =>
  withDescription(
    {
      title: news.title,
      image: news.imageKey
        ? {
            url: `${association.origin}${contentFileUrl(news.imageKey)}`,
            alt: filled(news.imageAlt) ?? association.name,
          }
        : fallbackImage(association),
      canonical: canonicalOf(association, `/actualites/${news.slug}`),
    },
    filled(news.seoDescription) ?? excerptOf(news.content, SEO_DESCRIPTION_MAX)
  )

/** Pages a adresse fixe et accueil : tout vient de l'association. */
export const resolveFixedPageSeo = (
  fixedPage: FixedPageSeoSource,
  association: AssociationSeoContext
): ResolvedSeo =>
  withDescription(
    {
      title: fixedPage.title,
      image: fallbackImage(association),
      canonical: canonicalOf(association, fixedPage.path),
    },
    filled(association.description)
  )

const ELLIPSIS = '…'

/** Texte brut d'un markdown : ni syntaxe, ni balise, espaces resserres. */
const plainTextOf = (markdown: string): string =>
  markdown
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/^\s{0,3}#{1,6}\s+/gm, '')
    .replaceAll(/^\s{0,3}>\s?/gm, '')
    .replaceAll(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replaceAll(/[*_~`]+/g, '')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\s+([.,])/g, '$1')
    .trim()

/**
 * Debut d'un texte markdown, en texte brut, coupe au mot et termine par « … »
 * s'il depasse `maxLength` (points de suspension compris). Rien pour un texte
 * vide.
 */
export const excerptOf = (
  markdown: string,
  maxLength: number
): string | undefined => {
  const text = plainTextOf(markdown)
  if (text === '') return undefined
  if (text.length <= maxLength) return text

  const head = text.slice(0, maxLength - ELLIPSIS.length + 1)
  const lastSpace = head.lastIndexOf(' ')
  const cut = (lastSpace > 0 ? head.slice(0, lastSpace) : head).replace(
    /[\s.,;:!?]+$/,
    ''
  )
  return `${cut}${ELLIPSIS}`
}

/** Locale des cartes de partage : le produit ne sert que le francais. */
export const OPEN_GRAPH_LOCALE = 'fr_FR'

/**
 * Les metadonnees Next d'une page publique, a partir de sa chaine de repli
 * resolue. Complete a chaque page : `openGraph` et `twitter` d'un parent sont
 * remplaces, jamais fusionnes. Sans description, `null` retire la balise au
 * lieu d'heriter de celle du parent.
 */
export const toPageMetadata = (
  seo: ResolvedSeo,
  siteName: string,
  options: {absoluteTitle?: boolean; type?: 'website' | 'article'} = {}
): Metadata => {
  const description = seo.description ? {description: seo.description} : {}
  const images = [{url: seo.image.url, alt: seo.image.alt}]

  return {
    title: options.absoluteTitle ? {absolute: seo.title} : seo.title,
    description: seo.description ?? null,
    alternates: {canonical: seo.canonical},
    openGraph: {
      type: options.type ?? 'website',
      url: seo.canonical,
      siteName,
      locale: OPEN_GRAPH_LOCALE,
      title: seo.title,
      ...description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      ...description,
      images,
    },
  }
}

/**
 * Directive des layouts authentifies (s11, critere 3) : toute route creee
 * dessous est exclue des moteurs, quel que soit son segment.
 */
export const NO_INDEX_ROBOTS = {index: false, follow: false} as const
