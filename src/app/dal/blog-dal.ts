import 'server-only'

import {cache} from 'react'

import {routing} from '@/i18n/routing'
import {
  getAllMdxBlogPosts,
  getAllMdxSlugsWithLocales,
  getMdxBlogPost,
} from '@/lib/helper/blog.server'
import {
  dbPostToUnified,
  isMdxPublished,
  mdxPostToUnified,
} from '@/lib/helper/blog-adapters.server'
import {
  getAllPublishedPostSlugsService,
  getPublishedPostsWithTranslationsService,
} from '@/services/facades/post-service-facade'
import {UnifiedBlogPost} from '@/services/types/domain/blog-types'
import {SupportedLanguage} from '@/services/types/domain/post-types'

export const BLOG_POSTS_PER_PAGE = 10

export type PaginatedBlogResult = {
  posts: UnifiedBlogPost[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export type BlogAlternates = {
  canonical: string
  languages: Record<string, string>
}

export type BlogCategory = {
  slug: string
  name: string
  count: number
}

async function getAllPostsFromSources(
  locale: string
): Promise<UnifiedBlogPost[]> {
  const posts: UnifiedBlogPost[] = []
  const seenSlugs = new Set<string>()

  try {
    const dbResult = await getPublishedPostsWithTranslationsService(
      {limit: 1000, offset: 0},
      locale as SupportedLanguage
    )

    for (const post of dbResult.data) {
      const unified = dbPostToUnified(post, locale)
      if (unified) {
        posts.push(unified)
        seenSlugs.add(unified.slug)
      }
    }
  } catch {
    // DB error, continue with MDX
  }

  const mdxPosts = getAllMdxBlogPosts(locale)
  for (const mdxPost of mdxPosts) {
    if (seenSlugs.has(mdxPost.slug)) {
      continue
    }

    if (!isMdxPublished(mdxPost)) {
      continue
    }

    const unified = mdxPostToUnified(mdxPost, locale)
    posts.push(unified)
  }

  posts.sort((a, b) => {
    const dateA = a.publishedAt || a.createdAt || new Date(0)
    const dateB = b.publishedAt || b.createdAt || new Date(0)
    return dateB.getTime() - dateA.getTime()
  })

  return posts
}

export const getAllUnifiedBlogPostsDal = cache(
  async (locale: string): Promise<UnifiedBlogPost[]> => {
    return getAllPostsFromSources(locale)
  }
)

export const getPaginatedBlogPostsDal = cache(
  async (
    locale: string,
    page: number = 1,
    limit: number = BLOG_POSTS_PER_PAGE
  ): Promise<PaginatedBlogResult> => {
    const allPosts = await getAllPostsFromSources(locale)
    const total = allPosts.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const posts = allPosts.slice(start, start + limit)

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }
)

export const getBlogPostsByCategoryDal = cache(
  async (
    locale: string,
    categorySlug: string,
    page: number = 1,
    limit: number = BLOG_POSTS_PER_PAGE
  ): Promise<PaginatedBlogResult> => {
    const allPosts = await getAllPostsFromSources(locale)
    const categoryPosts = allPosts.filter(
      (post) =>
        post.category && slugifyCategory(post.category.name) === categorySlug
    )

    const total = categoryPosts.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const posts = categoryPosts.slice(start, start + limit)

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }
)

export const getAllBlogCategoriesDal = cache(
  async (locale: string): Promise<BlogCategory[]> => {
    const allPosts = await getAllPostsFromSources(locale)
    const categoryMap = new Map<string, {name: string; count: number}>()

    for (const post of allPosts) {
      if (post.category?.name) {
        const slug = slugifyCategory(post.category.name)
        const existing = categoryMap.get(slug)
        if (existing) {
          existing.count++
        } else {
          categoryMap.set(slug, {name: post.category.name, count: 1})
        }
      }
    }

    return Array.from(categoryMap.entries())
      .map(([slug, {name, count}]) => ({slug, name, count}))
      .sort((a, b) => b.count - a.count)
  }
)

export const getCategoryBySlugDal = cache(
  async (
    locale: string,
    categorySlug: string
  ): Promise<BlogCategory | null> => {
    const categories = await getAllBlogCategoriesDal(locale)
    return categories.find((c) => c.slug === categorySlug) || null
  }
)

async function getDbPostBySlug(
  slug: string,
  locale: string
): Promise<UnifiedBlogPost | null> {
  try {
    const result = await getPublishedPostsWithTranslationsService(
      {limit: 100, offset: 0},
      locale as SupportedLanguage
    )

    for (const post of result.data) {
      const translation = post.postTranslations?.find(
        (t) => t.language === locale && t.slug === slug
      )
      if (translation) {
        return dbPostToUnified(post, locale)
      }
    }
    return null
  } catch {
    return null
  }
}

export const getUnifiedBlogPostBySlugDal = cache(
  async (slug: string, locale: string): Promise<UnifiedBlogPost | null> => {
    const dbPost = await getDbPostBySlug(slug, locale)
    if (dbPost) {
      return dbPost
    }

    const mdxPost = getMdxBlogPost(slug, locale)
    if (mdxPost) {
      if (!isMdxPublished(mdxPost)) {
        return null
      }
      return mdxPostToUnified(mdxPost, locale)
    }

    return null
  }
)

export const getPostAlternatesDal = cache(
  async (
    slug: string,
    currentLocale: string,
    baseUrl: string
  ): Promise<BlogAlternates> => {
    const languages: Record<string, string> = {}

    for (const locale of routing.locales) {
      const post = await getUnifiedBlogPostBySlugDal(slug, locale)
      if (post) {
        languages[locale] = `${baseUrl}/${locale}/blog/${post.slug}`
      }
    }

    const defaultLocale = routing.defaultLocale
    if (languages[defaultLocale]) {
      languages['x-default'] = languages[defaultLocale]
    }

    return {
      canonical: `${baseUrl}/${currentLocale}/blog/${slug}`,
      languages,
    }
  }
)

export const getAllUnifiedBlogSlugsDal = cache(
  async (): Promise<{slug: string; locale: string}[]> => {
    const results: {slug: string; locale: string}[] = []
    const seenKeys = new Set<string>()

    try {
      const dbSlugs = await getAllPublishedPostSlugsService()
      for (const item of dbSlugs) {
        const key = `${item.slug}-${item.language}`
        if (!seenKeys.has(key)) {
          results.push({slug: item.slug, locale: item.language})
          seenKeys.add(key)
        }
      }
    } catch {
      // DB error, continue with MDX
    }

    const mdxSlugs = getAllMdxSlugsWithLocales()
    for (const item of mdxSlugs) {
      const key = `${item.slug}-${item.locale}`
      if (!seenKeys.has(key)) {
        results.push(item)
        seenKeys.add(key)
      }
    }

    return results
  }
)

export const getTotalPagesDal = cache(
  async (
    locale: string,
    limit: number = BLOG_POSTS_PER_PAGE
  ): Promise<number> => {
    const allPosts = await getAllPostsFromSources(locale)
    return Math.ceil(allPosts.length / limit)
  }
)

export const getCategoryTotalPagesDal = cache(
  async (
    locale: string,
    categorySlug: string,
    limit: number = BLOG_POSTS_PER_PAGE
  ): Promise<number> => {
    const result = await getBlogPostsByCategoryDal(
      locale,
      categorySlug,
      1,
      limit
    )
    return result.pagination.totalPages
  }
)

export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function getBlogListAlternates(
  locale: string,
  baseUrl: string,
  page?: number
): BlogAlternates {
  const languages: Record<string, string> = {}
  const pageSuffix = page && page > 1 ? `/page/${page}` : ''

  for (const loc of routing.locales) {
    languages[loc] = `${baseUrl}/${loc}/blog${pageSuffix}`
  }
  languages['x-default'] =
    `${baseUrl}/${routing.defaultLocale}/blog${pageSuffix}`

  return {
    canonical: `${baseUrl}/${locale}/blog${pageSuffix}`,
    languages,
  }
}

export function getCategoryAlternates(
  locale: string,
  categorySlug: string,
  baseUrl: string,
  page?: number
): BlogAlternates {
  const languages: Record<string, string> = {}
  const pageSuffix = page && page > 1 ? `/page/${page}` : ''

  for (const loc of routing.locales) {
    languages[loc] =
      `${baseUrl}/${loc}/blog/category/${categorySlug}${pageSuffix}`
  }
  languages['x-default'] =
    `${baseUrl}/${routing.defaultLocale}/blog/category/${categorySlug}${pageSuffix}`

  return {
    canonical: `${baseUrl}/${locale}/blog/category/${categorySlug}${pageSuffix}`,
    languages,
  }
}

export const getRelatedPostsDal = cache(
  async (
    locale: string,
    currentSlug: string,
    categoryName?: string,
    limit: number = 3
  ): Promise<UnifiedBlogPost[]> => {
    const allPosts = await getAllPostsFromSources(locale)

    const otherPosts = allPosts.filter((post) => post.slug !== currentSlug)

    if (otherPosts.length === 0) {
      return []
    }

    let sameCategoryPosts: UnifiedBlogPost[] = []
    let differentCategoryPosts: UnifiedBlogPost[] = []

    if (categoryName) {
      sameCategoryPosts = otherPosts.filter(
        (post) => post.category?.name === categoryName
      )
      differentCategoryPosts = otherPosts.filter(
        (post) => post.category?.name !== categoryName
      )
    } else {
      differentCategoryPosts = otherPosts
    }

    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    }

    const shuffledSameCategory = shuffleArray(sameCategoryPosts)
    const shuffledDifferentCategory = shuffleArray(differentCategoryPosts)

    const relatedPosts: UnifiedBlogPost[] = []

    for (const post of shuffledSameCategory) {
      if (relatedPosts.length >= limit) break
      relatedPosts.push(post)
    }

    for (const post of shuffledDifferentCategory) {
      if (relatedPosts.length >= limit) break
      relatedPosts.push(post)
    }

    return relatedPosts
  }
)
