import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {
  BLOG_POSTS_PER_PAGE,
  getAllBlogCategoriesDal,
  getBlogPostsByCategoryDal,
  getCategoryAlternates,
  getCategoryBySlugDal,
} from '@/app/dal/blog-dal'
import {BlogList} from '@/components/features/blog/blog-list'
import {env} from '@/env'
import {PagesConst} from '@/env'
import {routing} from '@/i18n/routing'
import {isPageEnabled} from '@/lib/utils'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return []
  }

  const params: {locale: string; category: string}[] = []

  for (const locale of routing.locales) {
    const categories = await getAllBlogCategoriesDal(locale)
    for (const category of categories) {
      params.push({locale, category: category.slug})
    }
  }

  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; category: string}>
}): Promise<Metadata> {
  const {locale, category: categorySlug} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogListPage'})

  const category = await getCategoryBySlugDal(locale, categorySlug)
  if (!category) {
    return {
      title: 'Category not found',
    }
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  const alternates = getCategoryAlternates(locale, categorySlug, baseUrl)

  return {
    title: t('category.title', {category: category.name}),
    description: t('category.description', {category: category.name}),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  }
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{locale: string; category: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }

  const {locale, category: categorySlug} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogListPage'})

  const category = await getCategoryBySlugDal(locale, categorySlug)
  if (!category) {
    return notFound()
  }

  const result = await getBlogPostsByCategoryDal(
    locale,
    categorySlug,
    1,
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
          {t('category.title', {category: category.name})}
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
