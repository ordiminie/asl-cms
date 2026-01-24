import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {
  BLOG_POSTS_PER_PAGE,
  getAllBlogCategoriesDal,
  getBlogListAlternates,
  getPaginatedBlogPostsDal,
} from '@/app/dal/blog-dal'
import {BlogList} from '@/components/features/blog/blog-list'
import {Badge} from '@/components/ui/badge'
import {env} from '@/env'
import {PagesConst} from '@/env'
import {routing} from '@/i18n/routing'
import {isPageEnabled} from '@/lib/utils'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogListPage'})

  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  const alternates = getBlogListAlternates(locale, baseUrl)

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  }
}

export default async function BlogListPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }

  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogListPage'})

  const [result, categories] = await Promise.all([
    getPaginatedBlogPostsDal(locale, 1, BLOG_POSTS_PER_PAGE),
    getAllBlogCategoriesDal(locale),
  ])
  const baseUrl = `/${locale}/blog`

  const translations = {
    noCategory: t('noCategory'),
    views: t('views'),
    likes: t('likes'),
    readMore: t('readMore'),
    noArticles: t('noArticles'),
    previous: t('pagination.previous'),
    next: t('pagination.next'),
    page: t('pagination.page'),
    of: t('pagination.of'),
  }

  return (
    <div>
      <header className="mb-12 text-center">
        <h1 className="text-foreground mb-4 text-4xl font-bold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground mx-auto mb-6 max-w-2xl text-xl">
          {t('description')}
        </p>
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/${locale}/blog/category/${category.slug}`}
              >
                <Badge
                  variant="secondary"
                  className="hover:bg-primary hover:text-primary-foreground cursor-pointer px-3 py-1 text-sm transition-colors"
                >
                  {category.name}
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    ({category.count})
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </header>

      <BlogList
        result={result}
        locale={locale}
        baseUrl={baseUrl}
        translations={translations}
      />
    </div>
  )
}
