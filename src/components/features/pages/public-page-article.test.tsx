import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const {createTranslator} = await import('next-intl')
  const messages = (await import('../../../../messages/fr.json')).default

  const translatorFor = createTranslator as unknown as (options: {
    locale: string
    messages: typeof messages
    namespace: string
  }) => (key: string) => string

  return {
    getTranslations: async (namespace: string) =>
      translatorFor({locale: 'fr', messages, namespace}),
  }
})

import {render, screen} from '@/__tests__/customRender'
import {PageBlockTypeConst} from '@/services/types/domain/page-block-types'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

import {PublicPageArticle} from './public-page-article'

const page = (
  overrides: Partial<PageWithBlocksDTO> = {}
): PageWithBlocksDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: '11111111-1111-4111-8111-111111111111',
  slug: 'bienvenue',
  title: 'Bienvenue aux Amis de l’Étang',
  status: 'published',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  blocks: [
    {
      id: 'second',
      type: PageBlockTypeConst.TEXT,
      rank: 1,
      data: {type: PageBlockTypeConst.TEXT, markdown: 'Deuxième paragraphe'},
    },
    {
      id: 'empty-image',
      type: PageBlockTypeConst.IMAGE,
      rank: 2,
      data: {type: PageBlockTypeConst.IMAGE, fileKey: null, alt: ''},
    },
    {
      id: 'first',
      type: PageBlockTypeConst.TEXT,
      rank: 0,
      data: {type: PageBlockTypeConst.TEXT, markdown: 'Premier paragraphe'},
    },
  ],
  ...overrides,
})

const renderArticle = async (
  props: Parameters<typeof PublicPageArticle>[0]
) => {
  const {container} = render(await PublicPageArticle(props))
  return container
}

describe('PublicPageArticle', () => {
  it('pose le titre de la page en h1', async () => {
    await renderArticle({page: page()})

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Bienvenue aux Amis de l’Étang',
      })
    ).toBeInTheDocument()
  })

  it('rend les blocs dans l ordre de leur rang et omet un bloc incomplet', async () => {
    const container = await renderArticle({page: page()})

    const blocks = container.querySelectorAll('.page-block')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toHaveTextContent('Premier paragraphe')
    expect(blocks[1]).toHaveTextContent('Deuxième paragraphe')
    expect(container.querySelector('img')).toBeNull()
  })

  it('sans aperçu : aucun bandeau', async () => {
    await renderArticle({page: page()})

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('aperçu d un brouillon : bandeau du brouillon', async () => {
    await renderArticle({page: page({status: 'draft'}), isPreview: true})

    expect(screen.getByRole('status')).toHaveTextContent(
      'cette page est en brouillon'
    )
  })

  it('aperçu d une page dépubliée : bandeau de la dépublication', async () => {
    await renderArticle({page: page({status: 'unpublished'}), isPreview: true})

    expect(screen.getByRole('status')).toHaveTextContent(
      'cette page est dépubliée'
    )
  })
})
