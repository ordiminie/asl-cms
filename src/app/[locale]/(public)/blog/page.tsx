import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {getPublishedPostsWithTranslationsAndPaginationDal} from '@/app/dal/post-dal'
import {Badge} from '@/components/ui/badge'
import {PagesConst} from '@/env'
import {routing} from '@/i18n/routing'
import {isPageEnabled} from '@/lib/utils'
import {SupportedLanguage} from '@/services/types/domain/post-types'

export const dynamic = 'force-static'
export const dynamicParams = false

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

  return {
    title: t('meta.title'),
    description: t('meta.description'),
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

  const postsResult = await getPublishedPostsWithTranslationsAndPaginationDal(
    {limit: 50, offset: 0},
    locale as SupportedLanguage
  )

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <div>
      <header className="mb-12 text-center">
        <h1 className="text-foreground mb-4 text-4xl font-bold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          {t('description')}
        </p>
      </header>

      <div className="grid gap-8">
        {postsResult.data.map((post) => {
          const translation = post.postTranslations?.find(
            (t) => t.language === locale
          )
          if (!translation) return null

          return (
            <article
              key={post.id}
              className="border-border bg-card hover:bg-muted/50 rounded-lg border p-6 transition-colors"
            >
              <div className="mb-3 flex items-center gap-3">
                <Badge variant="outline">
                  {post.category?.name || t('noCategory')}
                </Badge>
                {post.postHashtags && post.postHashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.postHashtags.slice(0, 2).map((postHashtag) => (
                      <Badge
                        key={postHashtag.hashtag?.id || postHashtag.hashtagId}
                        variant="secondary"
                        className="text-xs"
                      >
                        #{postHashtag.hashtag?.name || 'hashtag'}
                      </Badge>
                    ))}
                    {post.postHashtags.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{post.postHashtags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <h2 className="mb-3 text-2xl font-semibold">
                <Link
                  href={`/blog/${translation.slug}`}
                  className="text-foreground hover:text-primary transition-colors"
                >
                  {translation.title}
                </Link>
              </h2>

              <p className="text-muted-foreground mb-4 text-base leading-relaxed">
                {translation.description}
              </p>

              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <time>{formatDate(post.createdAt)}</time>
                <span>•</span>
                <span>
                  {post.nbView || 0} {t('views')}
                </span>
                <span>•</span>
                <span>
                  {post.nbLike || 0} {t('likes')}
                </span>
                <span>•</span>
                <Link
                  href={`/blog/${translation.slug}`}
                  className="hover:text-foreground font-medium transition-colors"
                >
                  {t('readMore')} →
                </Link>
              </div>
            </article>
          )
        })}
      </div>

      {postsResult.data.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-lg">{t('noArticles')}</p>
        </div>
      )}
    </div>
  )
}
