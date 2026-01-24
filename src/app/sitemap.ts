import {MetadataRoute} from 'next'

import {
  BLOG_POSTS_PER_PAGE,
  getAllBlogCategoriesDal,
  getAllUnifiedBlogSlugsDal,
  getCategoryTotalPagesDal,
  getTotalPagesDal,
} from '@/app/dal/blog-dal'
import {env} from '@/env'
import {routing} from '@/i18n/routing'

type SitemapEntry = {
  url: string
  lastModified?: string | Date
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  priority?: number
  alternates?: {
    languages?: Record<string, string>
  }
}

type RouteConfig = {
  path: string
  priority: number
  changeFrequency:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
}

function buildUrl(
  baseUrl: string,
  locale: string,
  path: string,
  defaultLocale: string
): string {
  const localePrefix = locale === defaultLocale ? '' : `/${locale}`
  return `${baseUrl}${localePrefix}${path}`
}

function buildAlternates(
  baseUrl: string,
  path: string,
  locales: readonly string[],
  defaultLocale: string
): Record<string, string> {
  const alternates: Record<string, string> = {
    'x-default': buildUrl(baseUrl, defaultLocale, path, defaultLocale),
  }

  for (const locale of locales) {
    alternates[locale] = buildUrl(baseUrl, locale, path, defaultLocale)
  }

  return alternates
}

function createEntriesForRoute(
  baseUrl: string,
  route: RouteConfig,
  locales: readonly string[],
  defaultLocale: string
): SitemapEntry[] {
  const alternates = buildAlternates(
    baseUrl,
    route.path,
    locales,
    defaultLocale
  )

  return locales.map((locale) => ({
    url: buildUrl(baseUrl, locale, route.path, defaultLocale),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: {
      languages: alternates,
    },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  const locales = routing.locales
  const defaultLocale = routing.defaultLocale

  const publicRoutes: RouteConfig[] = [
    {path: '', priority: 1.0, changeFrequency: 'daily'},
    {path: '/pricing', priority: 0.9, changeFrequency: 'weekly'},
    {path: '/faq', priority: 0.8, changeFrequency: 'monthly'},
    {path: '/blog', priority: 0.8, changeFrequency: 'daily'},
    {path: '/terms', priority: 0.5, changeFrequency: 'yearly'},
    {path: '/privacy', priority: 0.5, changeFrequency: 'yearly'},
  ]

  const sitemapEntries: SitemapEntry[] = []

  for (const route of publicRoutes) {
    sitemapEntries.push(
      ...createEntriesForRoute(baseUrl, route, locales, defaultLocale)
    )
  }

  try {
    // Blog posts (DB + MDX)
    const blogSlugs = await getAllUnifiedBlogSlugsDal()

    // Group by postId to handle language-specific slugs
    const postsById = new Map<string, {locale: string; slug: string}[]>()
    for (const {postId, slug, locale} of blogSlugs) {
      if (!postsById.has(postId)) {
        postsById.set(postId, [])
      }
      postsById.get(postId)?.push({locale, slug})
    }

    for (const [_postId, variants] of postsById) {
      // Build alternates with language-specific slugs
      const alternates: Record<string, string> = {}

      // Find the default locale slug for x-default
      const defaultVariant = variants.find((v) => v.locale === defaultLocale)
      if (defaultVariant) {
        alternates['x-default'] = buildUrl(
          baseUrl,
          defaultLocale,
          `/blog/${defaultVariant.slug}`,
          defaultLocale
        )
      }

      // Add each language with its specific slug
      for (const variant of variants) {
        alternates[variant.locale] = buildUrl(
          baseUrl,
          variant.locale,
          `/blog/${variant.slug}`,
          defaultLocale
        )
      }

      // Create entry for each language variant
      for (const variant of variants) {
        sitemapEntries.push({
          url: buildUrl(
            baseUrl,
            variant.locale,
            `/blog/${variant.slug}`,
            defaultLocale
          ),
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: {
            languages: alternates,
          },
        })
      }
    }

    // Blog pagination pages (/blog/page/2, /blog/page/3, etc.)
    for (const locale of locales) {
      const totalPages = await getTotalPagesDal(locale, BLOG_POSTS_PER_PAGE)

      for (let page = 2; page <= totalPages; page++) {
        const pagePath = `/blog/page/${page}`
        const alternates = buildAlternates(
          baseUrl,
          pagePath,
          locales,
          defaultLocale
        )

        sitemapEntries.push({
          url: buildUrl(baseUrl, locale, pagePath, defaultLocale),
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.6,
          alternates: {
            languages: alternates,
          },
        })
      }
    }

    // Blog categories (/blog/category/[slug])
    const categoriesPerLocale = new Map<string, Set<string>>()

    for (const locale of locales) {
      const categories = await getAllBlogCategoriesDal(locale)

      for (const category of categories) {
        if (!categoriesPerLocale.has(category.slug)) {
          categoriesPerLocale.set(category.slug, new Set())
        }
        categoriesPerLocale.get(category.slug)?.add(locale)
      }
    }

    for (const [categorySlug, availableLocales] of categoriesPerLocale) {
      const categoryPath = `/blog/category/${categorySlug}`

      const alternates: Record<string, string> = {
        'x-default': buildUrl(
          baseUrl,
          defaultLocale,
          categoryPath,
          defaultLocale
        ),
      }

      for (const locale of availableLocales) {
        alternates[locale] = buildUrl(
          baseUrl,
          locale,
          categoryPath,
          defaultLocale
        )
      }

      for (const locale of availableLocales) {
        sitemapEntries.push({
          url: buildUrl(baseUrl, locale, categoryPath, defaultLocale),
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.6,
          alternates: {
            languages: alternates,
          },
        })

        // Category pagination pages (/blog/category/[slug]/page/2, etc.)
        const categoryTotalPages = await getCategoryTotalPagesDal(
          locale,
          categorySlug,
          BLOG_POSTS_PER_PAGE
        )

        for (let page = 2; page <= categoryTotalPages; page++) {
          const categoryPagePath = `/blog/category/${categorySlug}/page/${page}`
          const pageAlternates: Record<string, string> = {
            'x-default': buildUrl(
              baseUrl,
              defaultLocale,
              categoryPagePath,
              defaultLocale
            ),
          }

          for (const loc of availableLocales) {
            pageAlternates[loc] = buildUrl(
              baseUrl,
              loc,
              categoryPagePath,
              defaultLocale
            )
          }

          sitemapEntries.push({
            url: buildUrl(baseUrl, locale, categoryPagePath, defaultLocale),
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.5,
            alternates: {
              languages: pageAlternates,
            },
          })
        }
      }
    }
  } catch (error) {
    console.error('Error fetching blog data for sitemap:', error)
  }

  return sitemapEntries
}
