import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {publicPageMetadata} from '@/lib/seo/public-metadata'
import {resolveFixedPageSeo} from '@/lib/seo/resolve-metadata'

import {ReportForm} from './report-form'

type ReportPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: ReportPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'ReportPage.metadata'})

  const title = t('title')
  return publicPageMetadata(
    (association) =>
      resolveFixedPageSeo({path: '/signaler', title}, association),
    {fallback: {title}}
  )
}

/**
 * Formulaire public « Signaler une fuite ou un incident » (s10, ecran 1 du
 * design), servi a `/signaler` — segment reserve aux slugs de page (ADR 020).
 * Sous `(public)/` : aucun compte n'est demande.
 *
 * Les categories proposees sont celles de l'association du domaine appele,
 * lues **a la requete**, sans `'use cache'` : une categorie supprimee n'est
 * plus proposee des la requete suivante (critere 5).
 */
export default async function ReportPage({params}: ReportPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  const tenant = await requireCurrentTenantDal()
  const categories = await getActiveReportCategoriesDal(tenant.id)

  return (
    <div className="mx-auto w-full max-w-[68ch] px-[18px] py-12 sm:px-6">
      <ReportForm categories={categories} />
    </div>
  )
}
