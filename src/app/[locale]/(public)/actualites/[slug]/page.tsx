import {Metadata} from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {
  canManageCurrentNewsDal,
  getNewsBySlugForPreviewDal,
  getPublicNewsBySlugDal,
  newsImageUrl,
} from '@/app/dal/news-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {formatNewsDate} from '@/lib/cms/format-news-date'
import {renderRestrictedMarkdown} from '@/lib/cms/render-page-block'
import {NewsDTO} from '@/services/types/domain/news-types'

type NewsItemParams = {params: Promise<{locale: string; slug: string}>}

/**
 * Une actualite qui n'est pas publiee n'existe pas pour un visiteur
 * (critere 3) ; le bureau, lui, la voit en apercu, lue **sans cache** pour
 * montrer le dernier enregistrement — meme patron que les pages de s04.
 */
const resolveNews = async (
  organizationId: string,
  slug: string
): Promise<{news: NewsDTO; isPreview: boolean} | undefined> => {
  const published = await getPublicNewsBySlugDal(organizationId, slug)
  if (published) return {news: published, isPreview: false}

  if (!(await canManageCurrentNewsDal())) return undefined

  const draft = await getNewsBySlugForPreviewDal(organizationId, slug)
  return draft ? {news: draft, isPreview: true} : undefined
}

export async function generateMetadata({
  params,
}: NewsItemParams): Promise<Metadata> {
  const {locale, slug} = await params
  setRequestLocale(locale)

  const tenant = await requireCurrentTenantDal()
  const resolved = await resolveNews(tenant.id, slug)

  return resolved ? {title: resolved.news.title} : {}
}

export default async function PublicNewsItemPage({params}: NewsItemParams) {
  const {locale, slug} = await params
  setRequestLocale(locale)

  const [tenant, t] = await Promise.all([
    requireCurrentTenantDal(),
    getTranslations('PublicNewsPage'),
  ])

  const resolved = await resolveNews(tenant.id, slug)
  if (!resolved) {
    notFound()
  }

  const {news, isPreview} = resolved
  const content = renderRestrictedMarkdown(news.content)

  return (
    <article className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6">
      {isPreview && (
        <p
          className="bg-accent text-accent-foreground rounded-md px-4 py-3 text-[15px]"
          role="status"
        >
          {t(
            news.status === 'unpublished'
              ? 'previewUnpublished'
              : 'previewDraft'
          )}
        </p>
      )}

      <Link href="/actualites" className="text-[18px] underline-offset-4">
        {t('backToList')}
      </Link>

      <p className="text-muted-foreground text-[18px]">
        {formatNewsDate(news.publishedOn)}
      </p>

      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {news.title}
      </h1>

      {news.imageKey && (
        <figure className="m-0">
          <Image
            src={newsImageUrl(news.imageKey)}
            alt={news.imageAlt}
            width={1040}
            height={520}
            unoptimized
            className="max-h-[520px] w-full rounded-md object-cover"
          />
        </figure>
      )}

      <div
        className="page-block text-[18px] leading-[1.65]"
        dangerouslySetInnerHTML={{__html: content}}
      />
    </article>
  )
}
