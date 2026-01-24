import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {
  getAllUnifiedBlogSlugsDal,
  getPostAlternatesDal,
  getRelatedPostsDal,
  getUnifiedBlogPostBySlugDal,
} from '@/app/dal/blog-dal'
import {BlogArticle} from '@/components/features/blog/blog-article'
import {env} from '@/env'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return []
  }

  try {
    const slugs = await getAllUnifiedBlogSlugsDal()
    return slugs.map(({slug, locale}) => ({
      locale,
      slug,
    }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>
}): Promise<Metadata> {
  const {locale, slug} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogPostPage'})

  const post = await getUnifiedBlogPostBySlugDal(slug, locale)

  if (!post) {
    return {
      title: 'Article non trouvé',
      description: "Cet article n'existe pas.",
    }
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  const alternates = await getPostAlternatesDal(slug, locale, baseUrl)

  return {
    title: `${post.title} | ${t('meta.title')}`,
    description: post.description || post.title,
    keywords: post.hashtags?.join(', '),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: post.title,
      description: post.description || post.title,
      type: 'article',
      publishedTime:
        post.publishedAt?.toISOString() || post.createdAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: post.author ? [post.author.name] : undefined,
      tags: post.hashtags,
      locale: locale,
      url: alternates.canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description || post.title,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{locale: string; slug: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }
  const {locale, slug} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogPostPage'})
  const tList = await getTranslations({locale, namespace: 'BlogListPage'})
  const tBlog = await getTranslations({locale, namespace: 'BlogPage'})

  const post = await getUnifiedBlogPostBySlugDal(slug, locale)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPostsDal(
    locale,
    slug,
    post.category?.name,
    3
  )

  const translations = {
    backToBlog: tBlog('backToBlog'),
    publishedOn: t('publishedOn'),
    updatedOn: t('updatedOn'),
    share: t('share'),
    comment: t('comment'),
    author: t('author'),
    writtenBy: t('writtenBy'),
    relatedArticles: t('relatedArticles'),
    readMore: tList('readMore'),
    views: tList('views'),
    likes: tList('likes'),
  }

  return (
    <BlogArticle
      post={post}
      locale={locale}
      relatedPosts={relatedPosts}
      translations={translations}
    />
  )
}
