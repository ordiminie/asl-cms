import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()})}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/member-profile-dal', () => ({
  canManageCurrentMemberProfilesDal: vi.fn(),
}))
vi.mock('../actions', () => ({createMemberProfileAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {canManageCurrentMemberProfilesDal} from '@/app/dal/member-profile-dal'

import BureauNewMemberProfilePage from './page'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async (
  searchParams: {vendeur?: string; parcelle?: string; date?: string} = {}
) => {
  const element = (await BureauNewMemberProfilePage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/bureau/proprietaires/nouveau — accès par rôle', () => {
  it('montre le formulaire au bureau', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Ajouter un propriétaire'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Enregistrer le propriétaire'})
    ).toBeInTheDocument()
  })

  it('refuse un membre simple', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Enregistrer le propriétaire'})
    ).not.toBeInTheDocument()
  })
})

describe('/bureau/proprietaires/nouveau — ouvert depuis une vente', () => {
  const SELLER_ID = '33333333-3333-4333-8333-333333333333'
  const PARCEL_ID = '66666666-6666-4666-8666-666666666666'

  beforeEach(() => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
  })

  it('fait revenir « Annuler » à la vente, la date conservée', async () => {
    await renderPage({
      vendeur: SELLER_ID,
      parcelle: PARCEL_ID,
      date: '2026-06-15',
    })

    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${SELLER_ID}/vente/${PARCEL_ID}?date=2026-06-15`
    )
  })

  it.each([
    ['un vendeur malformé', {vendeur: '../admin', parcelle: PARCEL_ID}],
    ['une parcelle absente', {vendeur: SELLER_ID}],
  ])('ignore %s : « Annuler » revient à la liste', async (_label, params) => {
    await renderPage(params)

    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires'
    )
  })

  it('ignore une date malformée, sans perdre le retour à la vente', async () => {
    await renderPage({vendeur: SELLER_ID, parcelle: PARCEL_ID, date: 'hier'})

    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${SELLER_ID}/vente/${PARCEL_ID}`
    )
  })
})
