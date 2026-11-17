import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, within} from '@/__tests__/customRender'
import type {
  MyContactDTO,
  MyLandDTO,
  MyLandsDTO,
} from '@/services/types/domain/member-space-types'

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
  getMyContactDal: vi.fn(),
  getMyEmailsDal: vi.fn(() => Promise.resolve(undefined)),
  getMyIncidentReportsDal: vi.fn(),
  getMyInvoicesDal: vi.fn(() =>
    Promise.resolve({
      landCount: 1,
      invoices: [
        {
          issuedOn: '2026-03-15',
          subject: 'Cotisation et eau 2026',
          parcelNumber: '12',
          meterNumber: null,
          holderName: null,
          amountCents: 41250,
          dueOn: '2026-04-15',
          status: 'En attente',
          statusClass: 'unpaid',
        },
      ],
    })
  ),
  getMyLandsDal: vi.fn(),
}))
vi.mock('./actions', () => ({updateMyContactAction: vi.fn()}))
vi.mock('./email-actions', () => ({
  addMyEmailAction: vi.fn(),
  cancelMyPendingEmailAction: vi.fn(),
  correctMyPendingEmailAction: vi.fn(),
  updateMyEmailAction: vi.fn(),
}))

import {
  getMyContactDal,
  getMyEmailsDal,
  getMyIncidentReportsDal,
  getMyInvoicesDal,
  getMyLandsDal,
} from '@/app/dal/member-space-dal'

import DashboardPage from './page'

/** `withAuth` rend un composant serveur asynchrone : on resout les deux niveaux. */
const renderServerPage = async (element: ReactElement) => {
  const type = element.type as (props: unknown) => Promise<ReactElement>

  return await type(element.props)
}

/** La lecture est deroulee par `use()` derriere le `<Suspense>` : sous `act`. */
const renderDashboard = async (
  searchParams: {role?: string; signalement?: string; question?: string} = {}
) => {
  const page = await renderServerPage(
    await DashboardPage({searchParams: Promise.resolve(searchParams)})
  )
  await act(async () => {
    render(page)
  })
}

/** Un seul terrain (s12d) ; s53 en reunit plusieurs sous le meme compte. */
const parcelsOf = (overrides: Partial<MyLandDTO> = {}): MyLandsDTO => ({
  accountName: 'Membre Test',
  lands: [
    {
      name: 'Claire Meunier',
      current: [
        {number: '12', startsOn: '1998-02-03', meterNumber: null},
        {number: '13', startsOn: '2009-09-11', meterNumber: null},
      ],
      former: [],
      ...overrides,
    },
  ],
})

const CONTACT: MyContactDTO = {
  phone: '06 12 34 56 78',
  homeAddressLine: '4 chemin des Oliviers',
  homeAddressComplement: null,
  homePostalCode: '13100',
  homeCity: 'Aix-en-Provence',
  landCount: 1,
  divergent: false,
  groups: [],
}

const SECURITY_DESCRIPTION =
  'Votre mot de passe et les appareils connectés à votre compte.'

const myParcels = () => screen.getByRole('region', {name: 'Mes terrains'})
const myContact = () => screen.getByRole('region', {name: 'Mes coordonnées'})

const isBefore = (first: Element, second: Element) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMyLandsDal).mockResolvedValue(undefined)
  vi.mocked(getMyContactDal).mockResolvedValue(undefined)
  vi.mocked(getMyIncidentReportsDal).mockResolvedValue(undefined)
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
    expect(screen.getByText(SECURITY_DESCRIPTION)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer la sécurité du compte'})
    ).toHaveAttribute('href', '/account')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('region', {name: 'Mes coordonnées'})).toBeNull()
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

  it('C7 (s16) : une fiche sans parcelle voit « Mes coordonnées », sans salutation', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(
      parcelsOf({current: [], former: []})
    )
    vi.mocked(getMyContactDal).mockResolvedValue(CONTACT)

    await renderDashboard()

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Votre espace membre',
      })
    ).toBeInTheDocument()
    expect(screen.queryByText('Bonjour Claire Meunier')).toBeNull()
    expect(screen.queryByText('Espace personnel')).toBeNull()
    expect(screen.queryByRole('region', {name: 'Mes terrains'})).toBeNull()
    expect(myContact()).toHaveTextContent('06 12 34 56 78')
    expect(
      isBefore(
        myContact(),
        screen.getByRole('heading', {level: 2, name: 'Sécurité du compte'})
      )
    ).toBe(true)
  })
})

describe('/dashboard — « Mes terrains » (s12d, écran C)', () => {
  beforeEach(() => {
    vi.mocked(getMyContactDal).mockResolvedValue(CONTACT)
  })

  it('C1 : marqueur personnel, salutation au nom de la fiche, parcelles actuelles en clair', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

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
      'Compteur non renseigné',
      'Parcelle 13Propriétaire depuis le 11 septembre 2009',
      'Compteur non renseigné',
    ])
    expect(within(items[0]).getByText('12')).toHaveClass('font-mono')
    expect(within(myParcels()).queryByRole('table')).toBeNull()
    expect(within(myParcels()).queryByText('Anciennes parcelles')).toBeNull()
  })

  it('dit au pied de la carte à qui écrire en cas d’erreur', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes terrains'})
    expect(myParcels()).toHaveTextContent('Une erreur ? Écrivez au bureau.')
    expect(
      within(myParcels()).getByRole('link', {name: 'Page Contact'})
    ).toHaveAttribute('href', '/contact')
  })

  it('C1 (s16) : « Mes coordonnées » entre « Mes terrains » et « Sécurité du compte »', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes coordonnées'})
    expect(myContact()).toHaveTextContent('06 12 34 56 78')
    expect(isBefore(myParcels(), myContact())).toBe(true)
    expect(
      isBefore(
        myContact(),
        screen.getByRole('heading', {level: 2, name: 'Sécurité du compte'})
      )
    ).toBe(true)
    expect(screen.getByText(SECURITY_DESCRIPTION)).toBeInTheDocument()
  })

  it('s19 : « Mes factures » entre « Mes terrains » et « Mes coordonnées », lue sur l’association du domaine', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    const invoices = await screen.findByRole('region', {name: 'Mes factures'})
    expect(getMyInvoicesDal).toHaveBeenCalledWith()
    expect(within(invoices).getAllByText('Cotisation et eau 2026').length).toBe(
      2
    )
    expect(isBefore(myParcels(), invoices)).toBe(true)
    expect(isBefore(invoices, myContact())).toBe(true)
  })

  it('s54 : « Mes adresses email » juste après « Mes coordonnées »', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())
    vi.mocked(getMyEmailsDal).mockResolvedValue({
      landCount: 1,
      confirmationDays: 7,
      emails: [
        {
          email: 'claire.meunier@exemple.fr',
          status: 'active',
          own: true,
          holder: true,
          pendingId: null,
          ownEmailId: 'e1',
          replacesOwn: false,
          sentAt: null,
          expiresAt: null,
          onlyParcelNumbers: null,
        },
      ],
    })

    await renderDashboard()

    const emails = await screen.findByRole('region', {
      name: 'Mes adresses email',
    })
    expect(emails).toHaveTextContent('claire.meunier@exemple.fr')
    expect(isBefore(myContact(), emails)).toBe(true)
    expect(
      isBefore(
        emails,
        screen.getByRole('heading', {level: 2, name: 'Sécurité du compte'})
      )
    ).toBe(true)
  })

  it('garde la carte « Sécurité du compte » de s46 sous « Mes terrains »', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

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
    vi.mocked(getMyLandsDal).mockResolvedValue(
      parcelsOf({
        current: [{number: '21', startsOn: '2011-04-02', meterNumber: null}],
        former: [{number: '9', startsOn: '2003-05-14', endsOn: '2019-10-01'}],
      })
    )

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes terrains'})
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
    vi.mocked(getMyLandsDal).mockResolvedValue(
      parcelsOf({
        current: [],
        former: [{number: '47', startsOn: '1998-02-03', endsOn: '2026-06-15'}],
      })
    )

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes terrains'})
    expect(
      screen.getByText('Espace personnel').parentElement
    ).toHaveTextContent(/^Espace personnel\s*· Aucune parcelle actuelle$/)
    expect(myParcels()).toHaveTextContent(
      'Vous n’êtes plus propriétaire d’une parcelle du domaine depuis le 15 juin 2026.'
    )
    expect(within(myParcels()).queryByText('Parcelles actuelles')).toBeNull()
  })

  it('montre un squelette au nom du compte pendant le chargement, sans marqueur', async () => {
    vi.mocked(getMyLandsDal).mockReturnValue(new Promise(() => {}))

    await renderDashboard()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Bonjour Membre Test'})
    ).toBeInTheDocument()
    expect(screen.queryByText('Espace personnel')).toBeNull()
    const loading = screen.getByRole('region', {name: 'Mes terrains'})
    expect(loading).toHaveAttribute('aria-busy', 'true')
  })

  it('C8 (s16) : « Mes coordonnées » aussi en squelette pendant le chargement', async () => {
    vi.mocked(getMyLandsDal).mockReturnValue(new Promise(() => {}))
    vi.mocked(getMyContactDal).mockReturnValue(new Promise(() => {}))

    await renderDashboard()

    expect(
      screen.getByRole('heading', {level: 2, name: 'Mes coordonnées'})
    ).toBeInTheDocument()
    expect(myContact()).toHaveAttribute('aria-busy', 'true')
    expect(isBefore(myParcels(), myContact())).toBe(true)
  })
})

/** s14, A12 : après sa propre rétrogradation, l’espace personnel le dit. */
describe('/dashboard?role=retire — rôle retiré (s14, A12)', () => {
  beforeEach(() => {
    vi.mocked(getMyContactDal).mockResolvedValue(CONTACT)
  })

  it('dit « Vous ne faites plus partie du bureau. » en tête, role="status"', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())
    await renderDashboard({role: 'retire'})

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Vous ne faites plus partie du bureau.')
    expect(status).toHaveTextContent('Votre espace personnel reste ouvert.')
    expect(
      status.compareDocumentPosition(screen.getByRole('heading', {level: 1})) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('ne dit rien sans le paramètre', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())
    await renderDashboard()

    await screen.findByRole('heading', {level: 1})
    expect(
      screen.queryByText('Vous ne faites plus partie du bureau.')
    ).toBeNull()
  })
})

/** s22, écran A : « Mes signalements » entre « Mes coordonnées » et la sécurité. */
describe('/dashboard — « Mes signalements » (s22, écran A)', () => {
  const myReports = () => screen.getByRole('region', {name: 'Mes signalements'})
  const security = () =>
    screen.getByRole('heading', {level: 2, name: 'Sécurité du compte'})

  beforeEach(() => {
    vi.mocked(getMyContactDal).mockResolvedValue(CONTACT)
    vi.mocked(getMyIncidentReportsDal).mockResolvedValue([
      {
        id: 'r1',
        categoryName: 'Fuite d’eau',
        location: 'chemin des Pins',
        status: 'in_progress',
        createdAt: new Date('2026-11-04T10:00:00Z'),
        updatedAt: new Date('2026-11-05T10:00:00Z'),
      },
    ])
  })

  it('intercale la carte entre « Mes coordonnées » et « Sécurité du compte »', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(myReports()).toHaveTextContent('En cours')
    expect(isBefore(myContact(), myReports())).toBe(true)
    expect(isBefore(myReports(), security())).toBe(true)
  })

  it('la garde pour une fiche sans parcelle (C7)', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(
      parcelsOf({current: [], former: []})
    )

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(isBefore(myContact(), myReports())).toBe(true)
    expect(isBefore(myReports(), security())).toBe(true)
  })

  it('n’affiche aucune carte pour un compte sans fiche (C5)', async () => {
    vi.mocked(getMyContactDal).mockResolvedValue(undefined)

    await renderDashboard()

    await screen.findByRole('heading', {level: 1})
    expect(screen.queryByRole('region', {name: 'Mes signalements'})).toBeNull()
  })

  it('A5 : au retour d’un envoi, l’alerte de succès dans la carte', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard({signalement: 'envoye'})

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(within(myReports()).getByRole('status')).toHaveTextContent(
      'Signalement envoyé. Le bureau de l’association l’a reçu.'
    )
  })

  it('sans le paramètre, aucune alerte de succès', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(within(myReports()).queryByRole('status')).toBeNull()
  })

  it('A3 : la carte en squelette pendant la lecture, le bouton visible', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())
    vi.mocked(getMyIncidentReportsDal).mockReturnValue(new Promise(() => {}))

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(myReports()).toHaveAttribute('aria-busy', 'true')
    expect(
      within(myReports()).getByRole('link', {
        name: 'Signaler une fuite ou un incident',
      })
    ).toBeInTheDocument()
  })
})

/** s23, écran A : « Une question pour le bureau ? » sous « Mes signalements ». */
describe('/dashboard — « Une question pour le bureau ? » (s23, écran A)', () => {
  const myQuestion = () =>
    screen.getByRole('region', {name: 'Une question pour le bureau ?'})
  const myReports = () => screen.getByRole('region', {name: 'Mes signalements'})
  const security = () =>
    screen.getByRole('heading', {level: 2, name: 'Sécurité du compte'})

  beforeEach(() => {
    vi.mocked(getMyContactDal).mockResolvedValue(CONTACT)
    vi.mocked(getMyIncidentReportsDal).mockResolvedValue([])
  })

  it('A1 : place la carte sous « Mes signalements », avant la sécurité, avec un bouton outline', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(isBefore(myReports(), myQuestion())).toBe(true)
    expect(isBefore(myQuestion(), security())).toBe(true)
    expect(myQuestion()).toHaveTextContent(
      'Choisissez le sujet : votre question arrive directement à la personne du bureau qui s’en occupe.'
    )
    const ask = within(myQuestion()).getByRole('link', {
      name: 'Poser une question au bureau',
    })
    expect(ask).toHaveAttribute('href', '/dashboard/question')
    expect(ask).not.toHaveClass('bg-primary')
    expect(within(myQuestion()).queryByRole('status')).toBeNull()
  })

  it('la garde pour une fiche sans parcelle (C7)', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(
      parcelsOf({current: [], former: []})
    )

    await renderDashboard()

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(isBefore(myQuestion(), security())).toBe(true)
  })

  it('n’affiche pas la carte pour un compte sans fiche', async () => {
    vi.mocked(getMyContactDal).mockResolvedValue(undefined)

    await renderDashboard()

    await screen.findByRole('heading', {level: 1})
    expect(
      screen.queryByRole('region', {name: 'Une question pour le bureau ?'})
    ).toBeNull()
  })

  it('A2 : au retour d’un envoi, l’alerte de succès dans la carte et « Poser une autre question »', async () => {
    vi.mocked(getMyLandsDal).mockResolvedValue(parcelsOf())

    await renderDashboard({question: 'envoyee'})

    await screen.findByRole('region', {name: 'Mes signalements'})
    expect(within(myQuestion()).getByRole('status')).toHaveTextContent(
      'Question envoyée. Le bureau vous répondra à votre adresse email.'
    )
    expect(
      within(myQuestion()).getByRole('link', {name: 'Poser une autre question'})
    ).toHaveAttribute('href', '/dashboard/question')
  })
})
