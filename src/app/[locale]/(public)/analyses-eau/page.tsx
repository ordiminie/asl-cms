import {FileText} from 'lucide-react'
import {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  getPublicWaterAnalysesPageDal,
  getPublicWaterAnalysisPageCountDal,
  waterAnalysisFileUrl,
} from '@/app/dal/water-analysis-dal'
import {formatContentDate} from '@/lib/cms/format-content-date'
import {
  formatFileWeight,
  waterAnalysisDownloadName,
} from '@/services/types/domain/water-analysis-types'

type WaterAnalysisListParams = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: WaterAnalysisListParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'PublicWaterAnalysisPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Liste publique des analyses d'eau (design s09, ecran 4), servie a
 * `/analyses-eau` — segment reserve aux slugs de page (ADR 020). Sous
 * `(public)/` : **jamais** derriere l'authentification (critere 2).
 *
 * Le tenant vient du domaine appele : les analyses d'une association ne
 * paraissent jamais sur le site d'une autre (critere 5, garanti par la RLS).
 *
 * Un seul DOM par analyse, dans l'ordre de lecture titre -> affiche -> texte ->
 * lien ; sous 640 px, `order` remonte le lien au-dessus de l'affiche. Chaque
 * element ne porte qu'un element focalisable : le reordonnancement ne
 * desordonne aucun parcours au clavier.
 */
export default async function PublicWaterAnalysisPage({
  params,
  searchParams,
}: WaterAnalysisListParams) {
  const {locale} = await params
  setRequestLocale(locale)

  const [tenant, t] = await Promise.all([
    requireCurrentTenantDal(),
    getTranslations('PublicWaterAnalysisPage'),
  ])

  const {page} = await searchParams
  // Strictement des chiffres : `Number.parseInt` accepterait `2abc` comme 2.
  const requested = /^\d+$/.test(page ?? '1') ? Number(page ?? '1') : Number.NaN
  if (Number.isNaN(requested) || requested < 1) {
    notFound()
  }

  // Les bornes d'abord, la liste ensuite : la lecture de liste est cachee par
  // numero de page, et le numero vient du visiteur. Une page hors bornes
  // n'existe pas — sauf la page 1 d'une liste vide, qui rend l'etat vide.
  const totalPages = await getPublicWaterAnalysisPageCountDal(tenant.id)
  if (requested > totalPages) {
    notFound()
  }

  const list = await getPublicWaterAnalysesPageDal(tenant.id, requested)

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-[18px] pt-8 pb-16 sm:px-6">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>

      {list.items.length === 0 ? (
        <p className="text-[18px] leading-[1.65]">{t('empty')}</p>
      ) : (
        <ul className="divide-border flex list-none flex-col divide-y">
          {list.items.map((item) => {
            const date = formatContentDate(item.sampledOn)
            const text = item.content.trim()
            return (
              <li
                key={item.id}
                className="flex flex-col gap-6 py-12 first:pt-0 last:pb-0"
              >
                <h2 className="order-1 font-serif text-[26px] leading-tight font-semibold text-pretty">
                  {t('itemTitle', {date})}
                </h2>
                <figure className="bg-muted order-3 -mx-[18px] flex justify-center sm:order-2 sm:mx-0 sm:rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ratio d'origine inconnu : next/image exige des dimensions, et l'affiche ne se rogne jamais */}
                  <img
                    src={waterAnalysisFileUrl(item.posterKey)}
                    alt={t('posterAlt', {date})}
                    loading="lazy"
                    className="h-auto max-h-[520px] w-auto max-w-full object-contain"
                  />
                </figure>
                {text && (
                  <p
                    data-slot="water-analysis-text"
                    className="order-4 text-[18px] leading-[1.65] whitespace-pre-line sm:order-3"
                  >
                    {text}
                  </p>
                )}
                <a
                  href={waterAnalysisFileUrl(item.reportKey)}
                  download={waterAnalysisDownloadName(item.sampledOn)}
                  className="border-border hover:bg-muted order-2 flex min-h-14 w-full items-center gap-3 rounded-md border px-4 py-3 text-[18px] sm:order-4 sm:min-h-12 sm:w-auto sm:self-start"
                >
                  <FileText aria-hidden="true" className="size-5 shrink-0" />
                  <span>
                    <span className="sr-only">{t('downloadHint')} </span>
                    {t('download', {
                      date,
                      weight: formatFileWeight(item.reportBytes),
                    })}
                  </span>
                </a>
              </li>
            )
          })}
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
      href={`/analyses-eau?page=${page}`}
      className="border-border flex h-14 items-center rounded-md border px-4 text-[18px] sm:h-12"
    >
      {label}
    </Link>
  )
}
