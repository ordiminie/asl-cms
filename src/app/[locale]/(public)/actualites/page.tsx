import {Metadata} from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {getPublicNewsPageDal, newsImageUrl} from '@/app/dal/news-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {formatNewsDate} from '@/lib/cms/format-news-date'

type NewsListParams = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: NewsListParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'PublicNewsPage'})

  return {title: t('metadata.title')}
}

/**
 * Liste publique des actualites (ecran 3 du design s05), servie a
 * `/actualites` — segment reserve aux slugs de page (ADR 020).
 *
 * Le tenant vient du domaine appele : les actualites d'une association ne
 * paraissent jamais sur le site d'une autre (critere 4, garanti par la RLS).
 * Seules les publiees sont lues (critere 3).
 */
export default async function PublicNewsListPage({
  params,
  searchParams,
}: NewsListParams) {
  const {locale} = await params
  setRequestLocale(locale)

  const [tenant, t] = await Promise.all([
    requireCurrentTenantDal(),
    getTranslations('PublicNewsPage'),
  ])

  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  if (Number.isNaN(requested) || requested < 1) {
    notFound()
  }

  const list = await getPublicNewsPageDal(tenant.id, requested)
  // Une page hors bornes n'existe pas — sauf la page 1 d'une liste vide, qui
  // affiche l'etat vide plutot qu'une erreur.
  if (requested > list.totalPages) {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>

      {list.items.length === 0 ? (
        <p className="text-[18px] leading-[1.65]">{t('empty')}</p>
      ) : (
        <ul className="divide-border flex list-none flex-col divide-y">
          {list.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start"
            >
              {item.imageKey && (
                <Image
                  src={newsImageUrl(item.imageKey)}
                  alt={item.imageAlt}
                  width={160}
                  height={120}
                  unoptimized
                  className="aspect-4/3 w-full rounded-md object-cover sm:w-[160px]"
                />
              )}
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-muted-foreground text-[18px]">
                  {formatNewsDate(item.publishedOn)}
                </p>
                <h2 className="font-serif text-[26px] leading-tight font-semibold text-pretty">
                  <Link
                    href={`/actualites/${item.slug}`}
                    className="hover:underline"
                  >
                    {item.title}
                  </Link>
                </h2>
                <Link
                  href={`/actualites/${item.slug}`}
                  className="text-[18px] underline underline-offset-4"
                >
                  {t('read')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.items.length > 0 && (
        <nav
          className="flex flex-wrap items-center justify-between gap-3"
          aria-label={t('pagination.label')}
        >
          <PageControl
            page={list.page - 1}
            disabled={list.page <= 1}
            label={t('pagination.previous')}
          />
          <span className="text-[18px]">
            {t('pagination.position', {
              page: list.page,
              total: list.totalPages,
            })}
          </span>
          <PageControl
            page={list.page + 1}
            disabled={list.page >= list.totalPages}
            label={t('pagination.next')}
          />
        </nav>
      )}
    </div>
  )
}

/**
 * Un controle de pagination desactive reste **annonce** (`aria-disabled`) : le
 * visiteur doit pouvoir lire qu'il est au bout de la liste.
 */
function PageControl({
  page,
  disabled,
  label,
}: {
  page: number
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="text-muted-foreground flex h-14 items-center px-4 text-[18px] sm:h-12"
      >
        {label}
      </span>
    )
  }

  return (
    <Link
      href={`/actualites?page=${page}`}
      className="border-border flex h-14 items-center rounded-md border px-4 text-[18px] sm:h-12"
    >
      {label}
    </Link>
  )
}
