import {describe, expect, it} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  MyInvoiceDTO,
  MyInvoicesDTO,
} from '@/services/types/domain/member-space-types'

import {MyInvoicesCard, MyInvoicesCardLoading} from './my-invoices-card'

const invoice = (overrides: Partial<MyInvoiceDTO> = {}): MyInvoiceDTO => ({
  issuedOn: '2026-03-15',
  subject: 'Cotisation et eau 2026',
  parcelNumber: '12',
  meterNumber: '0045821',
  holderName: null,
  amountCents: 41250,
  dueOn: '2026-04-15',
  status: 'En attente',
  statusClass: 'unpaid',
  ...overrides,
})

const THREE: MyInvoicesDTO = {
  landCount: 3,
  invoices: [
    invoice({
      issuedOn: '2026-03-20',
      parcelNumber: '27',
      meterNumber: '0051207',
      dueOn: '2026-04-30',
      amountCents: 128000,
      status: 'Partiellement payée',
      statusClass: 'unclassified',
    }),
    invoice({
      parcelNumber: '31',
      meterNumber: null,
      holderName: 'SCI Les Pins',
      status: 'Relance 1',
    }),
    invoice({
      issuedOn: '2025-03-15',
      subject: 'Cotisation et eau 2025',
      dueOn: '2025-04-15',
      status: 'Payée',
      statusClass: 'settled',
    }),
  ],
}

const renderCard = async (invoices: MyInvoicesDTO) => {
  await act(async () => {
    render(<MyInvoicesCard invoices={invoices} />)
  })
}

const card = () =>
  screen.getByRole('region', {name: 'Mes factures'}) as HTMLElement
const table = () => within(card()).getByRole('table')
const bodyRows = () =>
  within(table()).getAllByRole('row').slice(1) as HTMLTableRowElement[]

describe('MyInvoicesCard — « Mes factures » (s19, écran 1)', () => {
  it('une seule liste pour tous les terrains, dans l’ordre reçu, colonnes du design', async () => {
    await renderCard(THREE)

    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual(['Émise le', 'Objet', 'Terrain', 'Montant', 'Échéance', 'Statut'])
    expect(bodyRows().map((row) => row.cells[0].textContent)).toEqual([
      '20/03/2026',
      '15/03/2026',
      '15/03/2025',
    ])
    expect(within(card()).getByText(/vos 3 terrains/)).toBeInTheDocument()
  })

  it('montant en euros, échéance distincte, terrain avec parcelle et compteur', async () => {
    await renderCard(THREE)

    const [first, second] = bodyRows()
    expect(first.cells[1]).toHaveTextContent('Cotisation et eau 2026')
    expect(first.cells[2]).toHaveTextContent('Parcelle 27')
    expect(first.cells[2]).toHaveTextContent('Compteur 0051207')
    expect(first.cells[3].textContent).toBe('1\u202f280,00 €')
    expect(first.cells[3]).toHaveClass('font-mono', 'tabular-nums')
    expect(first.cells[4]).toHaveTextContent('30/04/2026')
    expect(second.cells[2]).toHaveTextContent('Compteur non renseigné')
    expect(second.cells[2]).toHaveTextContent('SCI Les Pins')
  })

  it('le statut est écrit tel que fourni ; la variante du badge suit la classe', async () => {
    await renderCard(THREE)

    const badges = bodyRows().map(
      (row) => row.cells[5].querySelector('[data-slot="badge"]') as HTMLElement
    )
    expect(badges.map((badge) => badge.textContent)).toEqual([
      'Partiellement payée',
      'Relance 1',
      'Payée',
    ])
    expect(badges[0]).toHaveClass('bg-secondary')
    expect(badges[1]).not.toHaveClass('bg-secondary')
    expect(badges[1].querySelector('.bg-primary')).not.toBeNull()
    expect(badges[2]).not.toHaveClass('bg-secondary')
    expect(badges[2]).toHaveClass('text-muted-foreground')
    expect(badges[2].querySelector('.bg-primary')).toBeNull()
  })

  it('sous 640 px : une carte par facture, l’objet en titre puis le badge', async () => {
    await renderCard(THREE)

    const cards = within(card()).getAllByTestId('my-invoice-card')
    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveTextContent('Cotisation et eau 2026')
    expect(cards[0]).toHaveTextContent('Partiellement payée')
    expect(cards[0]).toHaveTextContent('Parcelle 27')
  })

  it('un seul terrain : la phrase d’introduction au singulier', async () => {
    await renderCard({landCount: 1, invoices: [invoice()]})

    expect(
      within(card()).getByText('Vos factures, les plus récentes en premier.')
    ).toBeInTheDocument()
  })

  it('vide : la phrase, et le renvoi vers le bureau', async () => {
    await renderCard({landCount: 2, invoices: []})

    expect(within(card()).queryByRole('table')).toBeNull()
    expect(
      within(card()).getByText(/Aucune facture pour l’instant/)
    ).toBeInTheDocument()
    expect(
      within(card()).getByRole('link', {name: /page Contact/})
    ).toHaveAttribute('href', '/contact')
  })

  it('au-delà de 25 factures : « Précédent / Suivant » écrits', async () => {
    await renderCard({
      landCount: 1,
      invoices: Array.from({length: 27}, (_, index) =>
        invoice({subject: `Facture ${index + 1}`})
      ),
    })

    expect(bodyRows()).toHaveLength(25)
    const pager = within(card()).getAllByRole('navigation')[0]
    await userEvent.click(within(pager).getByRole('button', {name: 'Suivant'}))
    expect(bodyRows()).toHaveLength(2)
    expect(within(pager).getByRole('button', {name: 'Précédent'})).toBeEnabled()
  })

  it('aucun identifiant de fiche ni de facture dans le DOM, aucun lien vers une facture', async () => {
    await renderCard(THREE)

    expect(card().innerHTML).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    )
    expect(
      within(card())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/contact'])
  })
})

describe('MyInvoicesCardLoading — chargement (1c)', () => {
  it('trois lignes en squelette, la carte occupée', async () => {
    await act(async () => {
      render(<MyInvoicesCardLoading />)
    })

    expect(card()).toHaveAttribute('aria-busy', 'true')
    expect(card().querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })
})
