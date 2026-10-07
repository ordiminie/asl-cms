import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/components/mdx-content', () => ({MDXContent: () => null}))

import {notFound} from 'next/navigation'

import {routing} from '@/i18n/routing'

import DocsPage, {
  generateMetadata,
  generateStaticParams,
} from './[...slug]/page'
import {getDocsStructureAction, searchDocsAction} from './actions'

const [servedLocale] = routing.locales

const introductionParams = () =>
  Promise.resolve({locale: servedLocale, slug: ['introduction']})

beforeEach(() => {
  vi.clearAllMocks()
})

/*
 * La documentation heritee n'a de contenu qu'en anglais (_files/en), alors que
 * le routage ne sert plus que le francais (s43). Le build exige au moins un
 * param par generateStaticParams sous Cache Components : sans ce lien entre
 * locale servie et locale du contenu, le build echoue.
 */
describe('documentation heritee sous la locale unique', () => {
  it('genere des params pour la seule locale servie', async () => {
    const params = await generateStaticParams()

    expect(params.length).toBeGreaterThan(0)
    expect(params.every(({locale}) => locale === servedLocale)).toBe(true)
    expect(params).toContainEqual({
      locale: servedLocale,
      slug: ['introduction'],
    })
  })

  it('trouve la page sous la locale servie (metadonnees)', async () => {
    const metadata = await generateMetadata({params: introductionParams()})

    expect(metadata.title).not.toBe('Page not found')
  })

  it('rend la page sous la locale servie, sans 404', async () => {
    await DocsPage({params: introductionParams()})

    expect(notFound).not.toHaveBeenCalled()
  })

  it('fournit la navigation laterale sous la locale servie', async () => {
    const structure = await getDocsStructureAction()

    expect(structure.items.length).toBeGreaterThan(0)
  })

  it('trouve des resultats de recherche', async () => {
    const results = await searchDocsAction('introduction')

    expect(results.length).toBeGreaterThan(0)
  })
})
