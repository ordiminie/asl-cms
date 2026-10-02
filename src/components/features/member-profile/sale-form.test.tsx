import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn()}))
const viewport = vi.hoisted(() => ({mobile: false}))

vi.mock('next/navigation', () => ({useRouter: () => router}))
vi.mock('@/components/hooks/use-mobile', () => ({
  useIsMobile: () => viewport.mobile,
}))

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {SaleContextDTO} from '@/services/types/domain/parcel-ownership-types'

import {SaleForm} from './sale-form'
import type {BuyerOption} from './sale-form-validation'

const DUBOIS_ID = '33333333-3333-4333-8333-333333333333'
const FERRAND_ID = '44444444-4444-4444-8444-444444444444'
const BLANC_ID = '55555555-5555-4555-8555-555555555555'
const PARCEL_ID = '66666666-6666-4666-8666-666666666666'

const context = (overrides: Partial<SaleContextDTO> = {}): SaleContextDTO => ({
  parcelId: PARCEL_ID,
  parcelNumber: '47',
  seller: {memberProfileId: DUBOIS_ID, name: 'Jean et Odile Dubois'},
  periods: [
    {
      id: 'period-dubois',
      memberProfileId: DUBOIS_ID,
      memberName: 'Jean et Odile Dubois',
      startsOn: '1998-02-03',
      endsOn: null,
    },
  ],
  ...overrides,
})

const FERRAND: BuyerOption = {
  id: FERRAND_ID,
  name: 'Paul Ferrand',
  currentParcelNumbers: [],
}
const FERREIRA: BuyerOption = {
  id: 'ferreira',
  name: 'Sophie Ferreira',
  currentParcelNumbers: ['8'],
}
const DUBOIS: BuyerOption = {
  id: DUBOIS_ID,
  name: 'Jean et Odile Dubois',
  currentParcelNumbers: ['47'],
}

const actions = {
  recordSaleAction: vi.fn(),
  searchBuyersAction: vi.fn(),
}

const renderSale = (
  input: {
    context?: SaleContextDTO
    initialDate?: string
    initialBuyer?: BuyerOption
  } = {}
) =>
  render(
    <SaleForm
      context={input.context ?? context()}
      today="2026-09-29"
      initialDate={input.initialDate}
      initialBuyer={input.initialBuyer}
      {...actions}
    />
  )

const dateField = () => screen.getByLabelText('Date de la vente')

const setDate = async (digits: string) => {
  await userEvent.clear(dateField())
  await userEvent.type(dateField(), digits)
}

const changes = () => screen.getByRole('region', {name: 'Ce qui va changer'})

const submit = async () =>
  userEvent.click(screen.getByRole('button', {name: 'Enregistrer la vente'}))

const sentFields = () =>
  Object.fromEntries(
    [...(actions.recordSaleAction.mock.calls[0][1] as FormData).entries()].map(
      ([key, value]) => [key, String(value)]
    )
  )

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  viewport.mobile = false
  actions.recordSaleAction.mockResolvedValue({status: 'recorded'})
  actions.searchBuyersAction.mockResolvedValue([FERRAND, FERREIRA])
})

describe('SaleForm — écran 5 du design s12', () => {
  it('titre la page, situe la vente et propose la date du jour', () => {
    renderSale()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Enregistrer la vente de la parcelle 47',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Jean et Odile Dubois'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${DUBOIS_ID}`)
    expect(screen.getByText('Vendre la parcelle 47')).toBeInTheDocument()
    expect(dateField()).toHaveValue('29/09/2026')
    expect(
      screen.getByText(
        'Le dernier jour de propriété du vendeur est la veille de cette date.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${DUBOIS_ID}`
    )
  })

  it('écrit la clôture à la veille de la vente, et attend l’acquéreur pour la suite', async () => {
    renderSale()

    await setDate('15062026')

    expect(changes()).toHaveTextContent(
      'Vendeur : Jean et Odile Dubois, propriétaire du 03/02/1998 au 14/06/2026. Cette période sera close et ne pourra plus être modifiée.'
    )
    expect(changes()).toHaveTextContent(
      'Choisissez l’acquéreur pour voir la suite.'
    )
    expect(changes()).not.toHaveTextContent('15/06/2026')
  })

  it('cherche l’acquéreur par son nom, parcelles actuelles en regard, et suit le choix', async () => {
    renderSale()
    await setDate('15062026')

    await userEvent.click(screen.getByRole('combobox', {name: /Acquéreur/}))
    await userEvent.type(screen.getByLabelText('Nom du propriétaire'), 'Ferr')

    const ferrand = await screen.findByRole('option', {name: /Paul Ferrand/})
    expect(ferrand).toHaveTextContent('Aucune parcelle actuelle')
    expect(
      screen.getByRole('option', {name: /Sophie Ferreira/})
    ).toHaveTextContent('Parcelle 8')
    expect(actions.searchBuyersAction).toHaveBeenLastCalledWith('Ferr')

    await userEvent.click(ferrand)

    expect(screen.getByRole('combobox', {name: /Acquéreur/})).toHaveTextContent(
      'Paul Ferrand'
    )
    expect(changes()).toHaveTextContent(
      'Acquéreur : Paul Ferrand, propriétaire à partir du 15/06/2026.'
    )
    expect(changes()).toHaveTextContent(
      'Les factures, relevés et documents antérieurs au 15/06/2026 restent ceux de Jean et Odile Dubois.'
    )
  })

  it('dit que la recherche a échoué, au lieu de « aucun résultat »', async () => {
    actions.searchBuyersAction.mockRejectedValue(new Error('pg down'))
    renderSale()

    await userEvent.click(screen.getByRole('combobox', {name: /Acquéreur/}))
    await userEvent.type(screen.getByLabelText('Nom du propriétaire'), 'Ferr')

    expect(
      await screen.findByText(
        'La recherche a échoué. Réessayez dans un instant.'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Aucun propriétaire ne correspond.')
    ).not.toBeInTheDocument()
  })

  it('reprend l’encart mot pour mot dans l’alert-dialog, puis enregistre et revient à la fiche du vendeur', async () => {
    renderSale({initialDate: '2026-06-15', initialBuyer: FERRAND})

    const written = changes().querySelector('[data-slot="sale-changes"]')
    await submit()

    const dialog = screen.getByRole('alertdialog', {
      name: 'Enregistrer la vente de la parcelle 47 ?',
    })
    const repeated = dialog.querySelector('[data-slot="sale-changes"]')
    expect(repeated?.textContent).toBe(written?.textContent)
    expect(repeated?.textContent).toContain('au 14/06/2026')
    expect(actions.recordSaleAction).not.toHaveBeenCalled()

    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Enregistrer la vente'})
    )

    expect(sentFields()).toEqual({
      sellerId: DUBOIS_ID,
      parcelId: PARCEL_ID,
      buyerId: FERRAND_ID,
      date: '15/06/2026',
    })
    expect(router.push).toHaveBeenCalledWith(
      `/bureau/proprietaires/${DUBOIS_ID}?vente=${PARCEL_ID}`
    )
  })

  it('n’envoie rien quand la confirmation est annulée', async () => {
    renderSale({initialDate: '2026-06-15', initialBuyer: FERRAND})

    await submit()
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Annuler',
      })
    )

    expect(actions.recordSaleAction).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('présélectionne l’acquéreur et conserve la date au retour de sa création', () => {
    renderSale({initialDate: '2026-06-15', initialBuyer: FERRAND})

    expect(dateField()).toHaveValue('15/06/2026')
    expect(screen.getByRole('combobox', {name: /Acquéreur/})).toHaveTextContent(
      'Paul Ferrand'
    )
    expect(changes()).toHaveTextContent(
      'Acquéreur : Paul Ferrand, propriétaire à partir du 15/06/2026.'
    )
  })

  it('mène à la création de l’acquéreur en emportant la vente et la date', async () => {
    renderSale()
    await setDate('15062026')

    expect(
      screen.getByText('L’acquéreur n’a pas encore de fiche ?')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Ajoutez-le d’abord'})
    ).toHaveAttribute(
      'href',
      `/bureau/proprietaires/nouveau?vendeur=${DUBOIS_ID}&parcelle=${PARCEL_ID}&date=2026-06-15`
    )
  })
})

describe('SaleForm — refus', () => {
  it('demande une date qui existe et un acquéreur, sans ouvrir la confirmation', async () => {
    renderSale()
    await setDate('31022026')

    await submit()

    expect(
      screen.getByText(
        'Cette date n’existe pas. Écrivez-la sous la forme jj/mm/aaaa.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Choisissez l’acquéreur.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('refuse une date antérieure au début de la période du vendeur (état 5e)', async () => {
    renderSale({initialDate: '1997-01-12', initialBuyer: FERRAND})

    await submit()

    expect(
      screen.getByText(
        'Jean et Odile Dubois n’est propriétaire que depuis le 03/02/1998 : la vente doit être postérieure à cette date.'
      )
    ).toBeInTheDocument()
    expect(dateField()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(actions.recordSaleAction).not.toHaveBeenCalled()
  })

  it('refuse le vendeur comme acquéreur (état 5f)', async () => {
    renderSale({initialDate: '2026-06-15', initialBuyer: DUBOIS})

    await submit()

    expect(
      screen.getByText(
        'Jean et Odile Dubois est le vendeur : choisissez un autre propriétaire comme acquéreur.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(actions.recordSaleAction).not.toHaveBeenCalled()
  })

  it('affiche le chevauchement rendu par le serveur, en nommant le propriétaire en place (état 5g)', async () => {
    actions.recordSaleAction.mockResolvedValue({
      status: 'overlap',
      conflict: {
        memberProfileId: BLANC_ID,
        name: 'Marc Blanc',
        startsOn: '2026-08-01',
        endsOn: null,
      },
    })
    renderSale({initialDate: '2026-06-15', initialBuyer: FERRAND})

    await submit()
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Enregistrer la vente',
      })
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'La vente n’a pas été enregistrée. La parcelle 47 a déjà un propriétaire enregistré à partir du 01/08/2026 : Marc Blanc. Une vente au 15/06/2026 lui donnerait deux propriétaires en même temps. Vérifiez la date, ou consultez la fiche de Marc Blanc.'
    )
    expect(
      within(alert).getByRole('link', {name: 'Ouvrir la fiche de Marc Blanc'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${BLANC_ID}`)
    expect(router.push).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('refuse avant tout envoi un chevauchement que l’écran connaît déjà, en nommant le propriétaire', async () => {
    const base = context()
    renderSale({
      context: {
        ...base,
        periods: [
          ...base.periods,
          {
            id: 'period-blanc',
            memberProfileId: BLANC_ID,
            memberName: 'Marc Blanc',
            startsOn: '2026-08-01',
            endsOn: '2027-01-01',
          },
        ],
      },
      initialDate: '2026-06-15',
      initialBuyer: FERRAND,
    })

    await submit()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La parcelle 47 a déjà un propriétaire enregistré à partir du 01/08/2026 : Marc Blanc.'
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(actions.recordSaleAction).not.toHaveBeenCalled()
  })

  it.each([
    [
      'la date refusée par le serveur',
      {status: 'date_not_after_start', startsOn: '1998-02-03'},
      'Jean et Odile Dubois n’est propriétaire que depuis le 03/02/1998 : la vente doit être postérieure à cette date.',
    ],
    [
      'l’acquéreur refusé par le serveur',
      {status: 'buyer_is_seller'},
      'Jean et Odile Dubois est le vendeur : choisissez un autre propriétaire comme acquéreur.',
    ],
    [
      'une parcelle déjà vendue entre-temps',
      {status: 'no_open_period'},
      'La vente n’a pas été enregistrée. Jean et Odile Dubois ne possède plus la parcelle 47.',
    ],
    [
      'un échec',
      {status: 'error', message: 'L’enregistrement a échoué.'},
      'L’enregistrement a échoué.',
    ],
  ])('affiche %s, sans quitter la page', async (_label, result, message) => {
    actions.recordSaleAction.mockResolvedValue(result)
    renderSale({initialDate: '2026-06-15', initialBuyer: FERRAND})

    await submit()
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Enregistrer la vente',
      })
    )

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('SaleForm — mobile', () => {
  it('cherche l’acquéreur dans un sheet de bas d’écran, « Annuler » écrit', async () => {
    viewport.mobile = true
    renderSale()

    await userEvent.click(screen.getByRole('combobox', {name: /Acquéreur/}))

    const sheet = screen.getByRole('dialog', {name: 'Choisir l’acquéreur'})
    await userEvent.type(
      within(sheet).getByLabelText('Nom du propriétaire'),
      'Ferr'
    )
    await userEvent.click(
      await within(sheet).findByRole('option', {name: /Paul Ferrand/})
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', {name: /Acquéreur/})).toHaveTextContent(
      'Paul Ferrand'
    )
  })

  it('ferme le sheet par « Annuler » sans rien choisir', async () => {
    viewport.mobile = true
    renderSale()

    await userEvent.click(screen.getByRole('combobox', {name: /Acquéreur/}))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Annuler'})
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', {name: /Acquéreur/})).toHaveTextContent(
      'Rechercher un propriétaire par son nom'
    )
  })
})
