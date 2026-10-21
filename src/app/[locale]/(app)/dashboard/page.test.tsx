import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, within} from '@/__tests__/customRender'
import type {MyParcelsDTO} from '@/services/types/domain/member-space-types'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  forbidden: vi.fn(),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(async () => ({
    id: '3f5a0a5e-0000-4000-8000-000000000001',
    name: 'Membre Test',
    email: 'membre@example.com',
    role: 'user',
    visibility: 'private',
  })),
  getSessionAuth: vi.fn(),
}))
vi.mock('@/app/dal/member-space-dal', () => ({
  getMyParcelsDal: vi.fn(),
}))

import {getMyParcelsDal} from '@/app/dal/member-space-dal'

import DashboardPage from './page'

/** `withAuth` rend un composant serveur asynchrone : on resout les deux niveaux. */
const renderServerPage = async (element: ReactElement) => {
  const type = element.type as (props: unknown) => Promise<ReactElement>

  return await type(element.props)
}

/** La lecture est deroulee par `use()` derriere le `<Suspense>` : sous `act`. */
const renderDashboard = async () => {
  const page = await renderServerPage(await DashboardPage({}))
  await act(async () => {
    render(page)
  })
}

const parcelsOf = (overrides: Partial<MyParcelsDTO> = {}): MyParcelsDTO => ({
  name: 'Claire Meunier',
  current: [
    {number: '12', startsOn: '1998-02-03'},
    {number: '13', startsOn: '2009-09-11'},
  ],
  former: [],
  ...overrides,
})

const myParcels = () => screen.getByRole('region', {name: 'Mes parcelles'})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMyParcelsDal).mockResolvedValue(undefined)
})

describe('/dashboard — compte sans fiche (s46, s12d C5)', () => {
  it('titre l espace membre, sans phrase sous le titre', async () => {
    await renderDashboard()

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Votre espace membre',
    })
    expect(heading.nextElementSibling?.tagName).not.toBe('P')
    expect(screen.queryByText('Espace personnel')).toBeNull()
  })

  it('propose la sécurité du compte par un lien vers /account', async () => {
    await renderDashboard()

    expect(await screen.findByText('Sécurité du compte')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Votre adresse email, votre mot de passe et les appareils connectés à votre compte.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer la sécurité du compte'})
    ).toHaveAttribute('href', '/account')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('ne garde rien du tableau de bord hérité', async () => {
    await renderDashboard()
    await screen.findByRole('heading', {level: 1, name: 'Votre espace membre'})

    for (const text of [
      "Vue d'ensemble de votre activité",
      'Espace client',
      'Revenu mensuel',
      'Aperçu',
      'Total Revenue',
      'Subscriptions',
    ]) {
      expect(screen.queryByText(text, {exact: false}), text).toBeNull()
    }
    expect(screen.queryByText('Membre Test')).toBeNull()
  })
})

describe('/dashboard — « Mes parcelles » (s12d, écran C)', () => {
  it('C1 : marqueur personnel, salutation au nom de la fiche, parcelles actuelles en clair', async () => {
    vi.mocked(getMyParcelsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Bonjour Claire Meunier',
      })
    ).toBeInTheDocument()
    const marker = screen.getByText('Espace personnel').parentElement
    expect(marker).toHaveTextContent(
      /^Espace personnel\s*· Parcelles 12 et 13$/
    )
    expect(
      within(myParcels()).getByRole('heading', {
        level: 3,
        name: 'Parcelles actuelles',
      })
    ).toBeInTheDocument()
    const items = within(myParcels()).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Parcelle 12Propriétaire depuis le 3 février 1998',
      'Parcelle 13Propriétaire depuis le 11 septembre 2009',
    ])
    expect(within(items[0]).getByText('12')).toHaveClass('font-mono')
    expect(within(myParcels()).queryByRole('table')).toBeNull()
    expect(within(myParcels()).queryByText('Anciennes parcelles')).toBeNull()
  })

  it('dit au pied de la carte à qui écrire en cas d’erreur', async () => {
    vi.mocked(getMyParcelsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes parcelles'})
    expect(myParcels()).toHaveTextContent('Une erreur ? Écrivez au bureau.')
    expect(
      within(myParcels()).getByRole('link', {name: 'Page Contact'})
    ).toHaveAttribute('href', '/contact')
  })

  it('garde la carte « Sécurité du compte » de s46 sous « Mes parcelles »', async () => {
    vi.mocked(getMyParcelsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    const security = await screen.findByRole('heading', {
      level: 2,
      name: 'Sécurité du compte',
    })
    expect(
      myParcels().compareDocumentPosition(security) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {name: 'Gérer la sécurité du compte'})
    ).toHaveAttribute('href', '/account')
  })

  it('C2 : liste les anciennes parcelles jusqu’à la veille de la vente, sans acquéreur', async () => {
    vi.mocked(getMyParcelsDal).mockResolvedValue(
      parcelsOf({
        current: [{number: '21', startsOn: '2011-04-02'}],
        former: [{number: '9', startsOn: '2003-05-14', endsOn: '2019-10-01'}],
      })
    )

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes parcelles'})
    expect(
      screen.getByText('Espace personnel').parentElement
    ).toHaveTextContent(/^Espace personnel\s*· Parcelle 21$/)
    const former = within(myParcels())
      .getByRole('heading', {level: 3, name: 'Anciennes parcelles'})
      .closest('section') as HTMLElement
    expect(former).toHaveTextContent(
      'Parcelle 9Propriétaire du 14 mai 2003 au 30 septembre 2019'
    )
    expect(former).not.toHaveTextContent('1 octobre 2019')
    expect(within(former).queryByRole('link')).toBeNull()
    expect(within(former).queryByRole('button')).toBeNull()
  })

  it('C3 : un ancien propriétaire lit depuis quand il ne l’est plus', async () => {
    vi.mocked(getMyParcelsDal).mockResolvedValue(
      parcelsOf({
        current: [],
        former: [{number: '47', startsOn: '1998-02-03', endsOn: '2026-06-15'}],
      })
    )

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes parcelles'})
    expect(
      screen.getByText('Espace personnel').parentElement
    ).toHaveTextContent(/^Espace personnel\s*· Aucune parcelle actuelle$/)
    expect(myParcels()).toHaveTextContent(
      'Vous n’êtes plus propriétaire d’une parcelle du domaine depuis le 15 juin 2026.'
    )
    expect(within(myParcels()).queryByText('Parcelles actuelles')).toBeNull()
  })

  it('montre un squelette au nom du compte pendant le chargement, sans marqueur', async () => {
    vi.mocked(getMyParcelsDal).mockReturnValue(new Promise(() => {}))

    await renderDashboard()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Bonjour Membre Test'})
    ).toBeInTheDocument()
    expect(screen.queryByText('Espace personnel')).toBeNull()
    const loading = screen.getByRole('region', {name: 'Mes parcelles'})
    expect(loading).toHaveAttribute('aria-busy', 'true')
  })
})
