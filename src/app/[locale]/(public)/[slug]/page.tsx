import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {
  canManageCurrentPagesDal,
  getPageBySlugForPreviewDal,
  getPublicPageBySlugDal,
} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {renderPageBlock} from '@/lib/cms/render-page-block'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

type PageParams = {params: Promise<{locale: string; slug: string}>}

/**
 * Page CMS publique, servie a la racine (`/{slug}`, ADR 020).
 *
 * Le tenant vient du domaine appele. Une page qui n'est pas publiee n'existe
 * pas pour un visiteur (critere 2) ; le bureau, lui, la voit en apercu, lue
 * **sans cache** pour montrer le dernier enregistrement. Chaque bloc est rendu
 * dans l'ordre de son rang ; un bloc incomplet ou de type inconnu est
 * simplement omis, jamais une boite vide (critere 9).
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
  const resolved = await resolvePage(tenant.id, slug)

  return resolved ? {title: resolved.page.title} : {}
}

export default async function PublicCmsPage({params}: PageParams) {
  const {locale, slug} = await params
  setRequestLocale(locale)

  const [tenant, t] = await Promise.all([
    requireCurrentTenantDal(),
    getTranslations('PublicCmsPage'),
  ])

  const resolved = await resolvePage(tenant.id, slug)
  if (!resolved) {
    notFound()
  }

  const {page, isPreview} = resolved
  const blocks = [...page.blocks]
    .sort((left, right) => left.rank - right.rank)
    .map((block) => ({id: block.id, html: renderPageBlock(block)}))
    .filter((block): block is {id: string; html: string} => block.html !== null)

  return (
    <article className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6">
      {isPreview && (
        <p
          className="bg-accent text-accent-foreground rounded-md px-4 py-3 text-[15px]"
          role="status"
        >
          {t(
            page.status === 'unpublished'
              ? 'previewUnpublished'
              : 'previewDraft'
          )}
        </p>
      )}

      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {page.title}
      </h1>

      {blocks.map((block) => (
        <div
          key={block.id}
          className="page-block text-[18px] leading-[1.65]"
          dangerouslySetInnerHTML={{__html: block.html}}
        />
      ))}
    </article>
  )
}
