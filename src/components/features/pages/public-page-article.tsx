import {getTranslations} from 'next-intl/server'

import {renderPageBlock} from '@/lib/cms/render-page-block'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

/**
 * Rendu public d'une page CMS (s04), partage par `/{slug}` et par l'accueil
 * `/` quand le bureau y a designe une page (s44). Chaque bloc est rendu dans
 * l'ordre de son rang ; un bloc incomplet ou de type inconnu est simplement
 * omis, jamais une boite vide. Le bandeau d'apercu n'apparait que pour le
 * bureau, sur une page non publiee.
 */
export async function PublicPageArticle({
  page,
  isPreview = false,
}: {
  page: PageWithBlocksDTO
  isPreview?: boolean
}) {
  const t = await getTranslations('PublicCmsPage')

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
