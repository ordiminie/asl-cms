import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/site-navigation-dal', () => ({
  getCurrentPublicSiteNavigationDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getCurrentPublicSiteNavigationDal} from '@/app/dal/site-navigation-dal'

import PublicFooter from './public-footer'

/** Le pied de page peut ne rien rendre : son arbre est donc nullable. */
const renderFooter = async () => {
  const rendered = await PublicFooter()
  if (rendered) render(rendered)
}

const withFooterContent = (footerContent: string) => {
  vi.mocked(getCurrentPublicSiteNavigationDal).mockResolvedValue({
    menu: [],
    footerContent,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PublicFooter — le pied de page compose par le bureau', () => {
  it('rend le contenu de l association en texte riche', async () => {
    withFooterContent(
      "## Nous écrire\n\nLes Amis de l'Étang — **contact@amis-etang.test**"
    )

    await renderFooter()

    const footer = screen.getByRole('contentinfo')
    expect(
      screen.getByRole('heading', {level: 2, name: 'Nous écrire'})
    ).toBeInTheDocument()
    expect(footer).toHaveTextContent('contact@amis-etang.test')
    expect(footer.querySelector('strong')).not.toBeNull()
  })

  /** Memes regles que le bloc « texte riche » des pages (design system §4). */
  it('ne rend pas ce que le texte riche restreint n autorise pas', async () => {
    withFooterContent('<script>alert(1)</script>\n\n# Titre de niveau 1')

    await renderFooter()

    const footer = screen.getByRole('contentinfo')
    expect(footer.querySelector('script')).toBeNull()
    expect(screen.queryByRole('heading', {level: 1})).toBeNull()
  })

  it('n affiche aucun pied de page quand le bureau n en a pas ecrit', async () => {
    withFooterContent('')

    await renderFooter()

    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  it('ne rend plus le pied de page SaaS du socle', async () => {
    withFooterContent('Les Amis de l’Étang')

    await renderFooter()

    expect(screen.queryByText(/Tous droits réservés/i)).toBeNull()
    expect(screen.queryByRole('link', {name: /Tarifs|Pricing/})).toBeNull()
  })
})
