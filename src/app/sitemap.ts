import {MetadataRoute} from 'next'

import {getAllPublishedPostSlugsDal} from '@/app/dal/post-dal'
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://www.youthumb.ai'
  const locales = routing.locales
  const defaultLocale = routing.defaultLocale

  const publicRoutes = [
    {path: '', priority: 1.0, changeFrequency: 'daily' as const},
    {path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const},
    {path: '/faq', priority: 0.8, changeFrequency: 'monthly' as const},
    {path: '/blog', priority: 0.8, changeFrequency: 'daily' as const},
    {path: '/terms', priority: 0.5, changeFrequency: 'yearly' as const},
    {path: '/privacy', priority: 0.5, changeFrequency: 'yearly' as const},
  ]

  const sitemapEntries: SitemapEntry[] = []

  // Ajouter les routes statiques
  for (const route of publicRoutes) {
    const alternates: Record<string, string> = {}

    for (const locale of locales) {
      const localePrefix = locale === defaultLocale ? '' : `/${locale}`
      alternates[locale] = `${baseUrl}${localePrefix}${route.path}`
    }

    const defaultUrl = `${baseUrl}${route.path}`

    sitemapEntries.push({
      url: defaultUrl,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: alternates,
      },
    })
  }

  // Ajouter les articles de blog
  try {
    const blogPosts = await getAllPublishedPostSlugsDal()

    // Grouper les posts par slug pour créer les alternates
    const postsBySlug = new Map<string, string[]>()
    for (const {slug, language} of blogPosts) {
      if (!postsBySlug.has(slug)) {
        postsBySlug.set(slug, [])
      }
      postsBySlug.get(slug)?.push(language)
    }

    // Créer une entrée par slug avec les alternates
    for (const [slug, languages] of postsBySlug) {
      const alternates: Record<string, string> = {}

      for (const language of languages) {
        const localePrefix = language === defaultLocale ? '' : `/${language}`
        alternates[language] = `${baseUrl}${localePrefix}/blog/${slug}`
      }

      const defaultUrl = `${baseUrl}/blog/${slug}`

      sitemapEntries.push({
        url: defaultUrl,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: {
          languages: alternates,
        },
      })
    }
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error)
  }

  return sitemapEntries
}
