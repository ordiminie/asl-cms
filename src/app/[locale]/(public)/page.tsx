import {Metadata} from 'next'
import {setRequestLocale} from 'next-intl/server'

import {getCurrentPublicHomePageDal} from '@/app/dal/home-page-dal'
import {getPublicNewsPageDal} from '@/app/dal/news-dal'
import {getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {HomeMinimal} from '@/components/features/association/home-minimal'
import {PublicPageArticle} from '@/components/features/pages/public-page-article'
import {publicPageMetadata} from '@/lib/seo/public-metadata'
import {resolveFixedPageSeo, resolvePageSeo} from '@/lib/seo/resolve-metadata'

type HomeParams = {params: Promise<{locale: string}>}

/**
 * Metadonnees de l'accueil (s44, decision E du plan) : avec une page
 * designee, celles de la page, canonique `/` ; sans page, le nom de
 * l'association seul. Canonique `/` dans les deux cas.
 */
export async function generateMetadata({
  params,
}: HomeParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)

  const homePage = await getCurrentPublicHomePageDal()
  if (homePage) {
    return publicPageMetadata((association) =>
      resolvePageSeo(homePage, association, {canonicalPath: '/'})
    )
  }

  return publicPageMetadata(
    (association) =>
      resolveFixedPageSeo({path: '/', title: association.name}, association),
    {absoluteTitle: true}
  )
}

/**
 * Accueil du site public (s44), sous le layout `(public)` pour en recevoir
 * la navigation et le pied de page ; le bandeau d'alerte vient du layout
 * `[locale]`. La page designee par le bureau si elle est publiee, sinon
 * l'accueil automatique.
 */
export default async function PublicHomePage({params}: HomeParams) {
  const {locale} = await params
  setRequestLocale(locale)

  const homePage = await getCurrentPublicHomePageDal()
  if (homePage) {
    return <PublicPageArticle page={homePage} />
  }

  const tenant = await requireCurrentTenantDal()
  const [association, news] = await Promise.all([
    getCurrentAssociationSeoDal(),
    getPublicNewsPageDal(tenant.id, 1),
  ])

  return (
    <HomeMinimal
      name={tenant.name}
      description={association?.description}
      news={news.items}
    />
  )
}
