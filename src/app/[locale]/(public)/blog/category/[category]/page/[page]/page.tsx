import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {
  BLOG_POSTS_PER_PAGE,
  getAllBlogCategoriesDal,
  getBlogPostsByCategoryDal,
  getCategoryAlternates,
  getCategoryBySlugDal,
  getCategoryTotalPagesDal,
} from '@/app/dal/blog-dal'
import {BlogList} from '@/components/features/blog/blog-list'
import {env} from '@/env'
import {PagesConst} from '@/env'
import {routing} from '@/i18n/routing'
import {isPageEnabled} from '@/lib/utils'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

export async function generateStaticParams() {
  const params: {locale: string; category: string; page: string}[] = []

  for (const locale of routing.locales) {
    const categories = await getAllBlogCategoriesDal(locale)
    for (const category of categories) {
      const totalPages = await getCategoryTotalPagesDal(locale, category.slug)
      for (let page = 2; page <= totalPages; page++) {
        params.push({locale, category: category.slug, page: String(page)})
      }
    }
  }

  // Cache Components exige au moins un param (empty-generate-static-params).
  // Les chemins non listes restent servis a la demande.
  return params.length > 0
    ? params
    : [{locale: routing.defaultLocale, category: 'none', page: '2'}]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; category: string; page: string}>
}): Promise<Metadata> {
  const {locale, category: categorySlug, page} = await params
  const pageNum = parseInt(page, 10)
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogListPage'})

  const category = await getCategoryBySlugDal(locale, categorySlug)
  if (!category) {
    return {
      title: 'Category not found',
    }
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  const alternates = getCategoryAlternates(
    locale,
    categorySlug,
    baseUrl,
    pageNum
  )
  const totalPages = await getCategoryTotalPagesDal(locale, categorySlug)

  const other: Record<string, string> = {}
  if (pageNum > 1) {
    const prevUrl =
      pageNum === 2
        ? `${baseUrl}/${locale}/blog/category/${categorySlug}`
        : `${baseUrl}/${locale}/blog/category/${categorySlug}/page/${pageNum - 1}`
    other['link'] = `<${prevUrl}>; rel="prev"`
  }
  if (pageNum < totalPages) {
    const nextUrl = `${baseUrl}/${locale}/blog/category/${categorySlug}/page/${pageNum + 1}`
    if (other['link']) {
      other['link'] += `, <${nextUrl}>; rel="next"`
    } else {
      other['link'] = `<${nextUrl}>; rel="next"`
    }
  }

  return {
    title: `${t('category.title', {category: category.name})} - ${t('pagination.page')} ${pageNum}`,
    description: t('category.description', {category: category.name}),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    other,
  }
}

export default async function BlogCategoryPaginatedPage({
  params,
}: {
  params: Promise<{locale: string; category: string; page: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }

  const {locale, category: categorySlug, page} = await params
  const pageNum = parseInt(page, 10)

  if (isNaN(pageNum) || pageNum < 1) {
    return notFound()
  }

  if (pageNum === 1) {
    redirect(`/${locale}/blog/category/${categorySlug}`)
  }

  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogListPage'})

  const category = await getCategoryBySlugDal(locale, categorySlug)
  if (!category) {
    return notFound()
  }

  const totalPages = await getCategoryTotalPagesDal(locale, categorySlug)
  if (pageNum > totalPages) {
    return notFound()
  }

  const result = await getBlogPostsByCategoryDal(
    locale,
    categorySlug,
    pageNum,
    BLOG_POSTS_PER_PAGE
  )

  const baseUrl = `/${locale}/blog/category/${categorySlug}`

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
          {t('category.title', {category: category.name})} -{' '}
          {t('pagination.page')} {pageNum}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          {t('category.description', {category: category.name})}
        </p>
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
