import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {setRequestLocale} from 'next-intl/server'

import {getCurrentPublicHomePageDal} from '@/app/dal/home-page-dal'
import {
  canManageCurrentPagesDal,
  getPageBySlugForPreviewDal,
  getPublicPageBySlugDal,
} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {PublicPageArticle} from '@/components/features/pages/public-page-article'
import {publicPageMetadata} from '@/lib/seo/public-metadata'
import {resolvePageSeo} from '@/lib/seo/resolve-metadata'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

type PageParams = {params: Promise<{locale: string; slug: string}>}

/**
 * Page CMS publique, servie a la racine (`/{slug}`, ADR 020).
 *
 * Le tenant vient du domaine appele. Une page qui n'est pas publiee n'existe
 * pas pour un visiteur (critere 2) ; le bureau, lui, la voit en apercu, lue
 * **sans cache** pour montrer le dernier enregistrement. Le rendu est celui
 * de `PublicPageArticle`, partage avec l'accueil `/` (s44) ; la page designee
 * comme accueil declare `/` comme canonique.
 */
const resolvePage = async (
  organizationId: string,
  slug: string
): Promise<{page: PageWithBlocksDTO; isPreview: boolean} | undefined> => {
  const published = await getPublicPageBySlugDal(organizationId, slug)
  if (published) return {page: published, isPreview: false}

  if (!(await canManageCurrentPagesDal())) return undefined

  const draft = await getPageBySlugForPreviewDal(organizationId, slug)
  return draft ? {page: draft, isPreview: true} : undefined
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const {locale, slug} = await params
  setRequestLocale(locale)

  const tenant = await requireCurrentTenantDal()
  const [resolved, homePage] = await Promise.all([
    resolvePage(tenant.id, slug),
    getCurrentPublicHomePageDal(),
  ])
  if (!resolved) return {}

  const isHomePage = homePage?.id === resolved.page.id
  return publicPageMetadata((association) =>
    resolvePageSeo(
      resolved.page,
      association,
      isHomePage ? {canonicalPath: '/'} : {}
    )
  )
}

export default async function PublicCmsPage({params}: PageParams) {
  const {locale, slug} = await params
  setRequestLocale(locale)

  const tenant = await requireCurrentTenantDal()
  const resolved = await resolvePage(tenant.id, slug)
  if (!resolved) {
    notFound()
  }

  return (
    <PublicPageArticle page={resolved.page} isPreview={resolved.isPreview} />
  )
}
