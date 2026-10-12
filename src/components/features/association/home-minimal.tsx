import Image from 'next/image'
import Link from 'next/link'
import {getTranslations} from 'next-intl/server'

import {formatContentDate} from '@/lib/cms/format-content-date'
import {contentFileUrl} from '@/services/types/domain/content-file-types'
import {HOME_NEWS_COUNT} from '@/services/types/domain/home-page-types'
import {NewsDTO} from '@/services/types/domain/news-types'

/**
 * Accueil automatique du site public (s44, ecran 3) : servi a `/` quand le
 * bureau n'a designe aucune page, ou quand celle-ci n'est plus publiee. Le
 * nom de l'association, sa description si elle existe, puis ses dernieres
 * actualites — jamais un texte, un lien ou un bouton du produit.
 */
export async function HomeMinimal({
  name,
  description,
  news,
}: {
  name: string
  description: string | null | undefined
  news: NewsDTO[]
}) {
  const t = await getTranslations('PublicHome')
  const latest = news.slice(0, HOME_NEWS_COUNT)

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-8 px-[18px] pt-8 pb-16 sm:px-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-[44px] leading-[48px] font-semibold tracking-[-0.01em] text-pretty">
          {name}
        </h1>
        {description && (
          <p
            data-slot="home-description"
            className="max-w-[68ch] text-[18px] leading-[1.65]"
          >
            {description}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="home-news">
        <h2
          id="home-news"
          className="font-serif text-[26px] leading-tight font-semibold text-pretty"
        >
          {t('newsTitle')}
        </h2>

        {latest.length === 0 ? (
          <p className="text-[18px] leading-[1.65]">{t('newsEmpty')}</p>
        ) : (
          <>
            <ul className="divide-border flex list-none flex-col divide-y">
              {latest.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start"
                >
                  {item.imageKey && (
                    <Image
                      src={contentFileUrl(item.imageKey)}
                      alt={item.imageAlt}
                      width={160}
                      height={120}
                      unoptimized
                      className="aspect-4/3 w-full rounded-md object-cover sm:w-[160px]"
                    />
                  )}
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-muted-foreground text-[18px]">
                      {formatContentDate(item.publishedOn)}
                    </p>
                    <h3 className="text-[20px] leading-[1.3] font-semibold text-pretty">
                      <Link
                        href={`/actualites/${item.slug}`}
                        className="hover:underline"
                      >
                        {item.title}
                      </Link>
                    </h3>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/actualites"
              className="flex min-h-11 items-center self-start text-[18px] underline underline-offset-4"
            >
              {t('allNews')}
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
