import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  MyInvoiceDTO,
  MyInvoicesDTO,
} from '@/services/types/domain/member-space-types'

import {MyInvoicesCard, MyInvoicesCardLoading} from './my-invoices-card'

const invoice = (overrides: Partial<MyInvoiceDTO> = {}): MyInvoiceDTO => ({
  issuedOn: '2026-03-15',
  subject: 'Cotisation et eau 2026',
  parcelNumbers: ['12'],
  meterNumber: '0045821',
  holderName: null,
  amountCents: 41250,
  dueOn: '2026-04-15',
  status: 'En attente',
  statusLabel: 'En attente',
  statusClass: 'unpaid',
  hasPdf: false,
  pdfRef: null,
  payment: null,
  ...overrides,
})

const SITE = {
  syncedFromPennylane: false,
  syncedAt: null,
  lastSyncFailed: false,
  unlinked: false,
} as const

const THREE: MyInvoicesDTO = {
  ...SITE,
  landCount: 3,
  invoices: [
    invoice({
      issuedOn: '2026-03-20',
      parcelNumbers: ['27'],
      meterNumber: '0051207',
      dueOn: '2026-04-30',
      amountCents: 128000,
      status: 'Partiellement payée',
      statusLabel: 'Partiellement payée',
      statusClass: 'unclassified',
    }),
    invoice({
      parcelNumbers: ['31'],
      meterNumber: null,
      holderName: 'SCI Les Pins',
      status: 'Relance 1',
      statusLabel: 'Relance 1',
    }),
    invoice({
      issuedOn: '2025-03-15',
      subject: 'Cotisation et eau 2025',
      dueOn: '2025-04-15',
      status: 'Payée',
      statusLabel: 'Payée',
      statusClass: 'settled',
    }),
  ],
}

const openPdf = vi.fn()
const navigate = vi.fn()

const renderCard = async (invoices: MyInvoicesDTO) => {
  await act(async () => {
    render(
      <MyInvoicesCard
        invoices={invoices}
        openPdfAction={openPdf}
        navigate={navigate}
      />
    )
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
    await renderCard({...SITE, landCount: 1, invoices: [invoice()]})

    expect(
      within(card()).getByText('Vos factures, les plus récentes en premier.')
    ).toBeInTheDocument()
  })

  it('vide : la phrase, et le renvoi vers le bureau', async () => {
    await renderCard({...SITE, landCount: 2, invoices: []})

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
      ...SITE,
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

describe('MyInvoicesCard — factures Pennylane (s20, écran 1)', () => {
  const PENNYLANE = {
    landCount: 1,
    syncedFromPennylane: true,
    syncedAt: '2026-11-19T13:05:00.000Z',
    lastSyncFailed: false,
    unlinked: false,
  } as const
  const withPdf = invoice({
    parcelNumbers: ['12', '13'],
    status: 'late',
    statusLabel: 'En retard',
    hasPdf: true,
    pdfRef: 'ref-pdf',
  })
  const withoutPdf = invoice({
    issuedOn: '2025-03-15',
    status: 'paid',
    statusLabel: 'paid',
    statusClass: 'settled',
  })

  beforeEach(() => {
    openPdf.mockReset()
    navigate.mockReset()
  })

  it('1a : colonne « Facture », bouton PDF seulement si la source en fournit un (critères 7 et 8)', async () => {
    await renderCard({...PENNYLANE, invoices: [withPdf, withoutPdf]})

    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual([
      'Émise le',
      'Objet',
      'Terrain',
      'Montant',
      'Échéance',
      'Statut',
      'Facture',
    ])
    const [first, second] = bodyRows()
    expect(
      within(first).getByRole('button', {
        name: 'PDF de la facture 2026, parcelles 12 et 13',
      })
    ).toBeInTheDocument()
    expect(within(second).queryByRole('button')).toBeNull()
    expect(second.cells[6]).toHaveTextContent('PDF non disponible')
  })

  it('aucun lien vers Pennylane dans la page : l’adresse est demandée au clic, puis ouverte', async () => {
    openPdf.mockResolvedValue({status: 'ready', url: 'https://pdf.test/x'})
    await renderCard({...PENNYLANE, invoices: [withPdf]})

    expect(card().innerHTML).not.toContain('pdf.test')
    await userEvent.click(
      within(bodyRows()[0]).getByRole('button', {name: /PDF de la facture/})
    )

    expect(openPdf).toHaveBeenCalledWith('ref-pdf')
    expect(navigate).toHaveBeenCalledWith('https://pdf.test/x')
  })

  it('1f : PDF impossible à ouvrir — une alerte, jamais un lien mort', async () => {
    openPdf.mockResolvedValue({status: 'unavailable'})
    await renderCard({...PENNYLANE, invoices: [withPdf]})

    await userEvent.click(
      within(bodyRows()[0]).getByRole('button', {name: /PDF de la facture/})
    )

    expect(await within(card()).findByRole('alert')).toHaveTextContent(
      'Le PDF n’a pas pu être ouvert. Réessayez dans un moment.'
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it('1f : l’alerte s’efface au clic suivant, et l’ouverture réussie ne la ravive pas', async () => {
    openPdf.mockResolvedValueOnce({status: 'unavailable'})
    await renderCard({...PENNYLANE, invoices: [withPdf]})
    const button = () =>
      within(bodyRows()[0]).getByRole('button', {name: /PDF de la facture/})

    await userEvent.click(button())
    expect(await within(card()).findByRole('alert')).toBeInTheDocument()

    let finish: (value: {status: 'ready'; url: string}) => void = () => {}
    openPdf.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    await userEvent.click(button())
    expect(within(card()).queryByRole('alert')).toBeNull()

    await act(async () => {
      finish({status: 'ready', url: 'https://pdf.test/x'})
    })
    expect(navigate).toHaveBeenCalledWith('https://pdf.test/x')
    expect(within(card()).queryByRole('alert')).toBeNull()
  })

  it('terrain à plusieurs parcelles et libellé du statut', async () => {
    await renderCard({...PENNYLANE, invoices: [withPdf]})

    const [row] = bodyRows()
    expect(row.cells[2]).toHaveTextContent('Parcelles 12 et 13')
    expect(row.cells[5]).toHaveTextContent('En retard')
    expect(row.cells[5]).not.toHaveTextContent('late')
  })

  it('sous 640 px : « Télécharger le PDF » sur la carte, ou la mention sans bouton', async () => {
    await renderCard({...PENNYLANE, invoices: [withPdf, withoutPdf]})

    const [first, second] = within(card()).getAllByTestId('my-invoice-card')
    expect(
      within(first).getByRole('button', {name: /PDF de la facture/})
    ).toHaveTextContent('Télécharger le PDF')
    expect(within(second).queryByRole('button')).toBeNull()
    expect(second).toHaveTextContent('PDF non disponible')
  })

  it('la date de la dernière mise à jour, heure de Paris', async () => {
    await renderCard({...PENNYLANE, invoices: [withPdf]})

    expect(
      within(card()).getByText('Factures mises à jour le 19/11/2026 à 14 h 05.')
    ).toBeInTheDocument()
  })

  it('1d : dernière mise à jour échouée — les factures telles qu’elles étaient, sans page en erreur (critère 9)', async () => {
    await renderCard({...PENNYLANE, lastSyncFailed: true, invoices: [withPdf]})

    expect(
      within(card()).getByText(
        'Les factures n’ont pas pu être mises à jour. Voici vos factures telles qu’elles étaient le 19/11/2026 à 14 h 05.'
      )
    ).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(1)
  })

  it('1e : compte non relié — la phrase dit que le bureau s’en occupe, à la place du vide', async () => {
    await renderCard({
      ...PENNYLANE,
      unlinked: true,
      syncedAt: null,
      invoices: [],
    })

    expect(
      within(card()).getByText(
        'Vos factures ne sont pas encore reliées à votre espace. Le bureau en est informé et s’en occupe.'
      )
    ).toBeInTheDocument()
    expect(within(card()).queryByText(/Aucune facture/)).toBeNull()
  })

  it('aucun formulaire ni champ de paiement', async () => {
    await renderCard({...PENNYLANE, invoices: [withPdf, withoutPdf]})

    expect(card().querySelector('form')).toBeNull()
    expect(card().querySelector('input')).toBeNull()
    expect(card().innerHTML).not.toMatch(/iban|mandat|carte bancaire/i)
  })

  it('saisie sur le site : ni colonne « Facture », ni date de mise à jour', async () => {
    await renderCard(THREE)

    expect(
      within(table()).queryByRole('columnheader', {name: 'Facture'})
    ).toBeNull()
    expect(within(card()).queryByText(/mises à jour le/)).toBeNull()
  })
})

describe('MyInvoicesCard — payer sa facture (s21, écran 1)', () => {
  const PAYMENT_URL = 'https://paiement.example.org/facture/2026-12'
  const PAYMENT_LABEL =
    'Payer la facture 2026, parcelles 12 et 13 (s’ouvre dans un nouvel onglet)'
  const NOTICE =
    'Les factures à régler se paient par virement. Pour toute question, écrivez au bureau depuis la page Contact.'
  const withLink = invoice({
    parcelNumbers: ['12', '13'],
    statusLabel: 'En retard',
    hasPdf: true,
    pdfRef: 'ref-pdf',
    payment: {kind: 'link', url: PAYMENT_URL},
  })
  const byTransfer = invoice({
    parcelNumbers: ['27'],
    status: 'Partiellement payée',
    statusLabel: 'Partiellement payée',
    payment: {kind: 'transfer'},
  })
  const settled = invoice({
    issuedOn: '2025-03-15',
    status: 'Payée',
    statusLabel: 'Payée',
    statusClass: 'settled',
  })
  const PENNYLANE = {
    landCount: 2,
    syncedFromPennylane: true,
    syncedAt: '2026-11-19T13:05:00.000Z',
    lastSyncFailed: false,
    unlinked: false,
  } as const

  it('critère 1 : un lien sortant vers l’adresse exacte du fournisseur, nouvel onglet annoncé', async () => {
    await renderCard({...PENNYLANE, invoices: [withLink, settled]})

    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual([
      'Émise le',
      'Objet',
      'Terrain',
      'Montant',
      'Échéance',
      'Statut',
      'Règlement',
      'Facture',
    ])
    const pay = within(table()).getByRole('link', {name: PAYMENT_LABEL})
    expect(pay.tagName).toBe('A')
    expect(pay).toHaveAttribute('href', PAYMENT_URL)
    expect(pay).toHaveAttribute('target', '_blank')
    expect(pay).toHaveAttribute('rel', 'noopener noreferrer')
    expect(pay).toHaveTextContent('Payer')
    expect(bodyRows()[0].cells[6]).toContainElement(pay)
  })

  it('critère 5 : une facture réglée n’a ni bouton ni mention de virement', async () => {
    await renderCard({...PENNYLANE, invoices: [withLink, settled]})

    const settledRow = bodyRows()[1]
    expect(settledRow.cells[6].textContent).toBe('')
    expect(within(settledRow).queryByRole('link')).toBeNull()
    expect(within(card()).queryByText(NOTICE)).toBeNull()
  })

  it('critère 3 : sans lien, « Par virement » sans bouton, et une seule phrase qui renvoie au bureau', async () => {
    await renderCard({...SITE, landCount: 2, invoices: [byTransfer, settled]})

    const transferRow = bodyRows()[0]
    expect(transferRow.cells[6]).toHaveTextContent('Par virement')
    expect(within(transferRow).queryByRole('link')).toBeNull()
    expect(within(card()).queryByRole('link', {name: /Payer/})).toBeNull()
    const notices = within(card()).getAllByRole('note')
    expect(notices).toHaveLength(1)
    expect(notices[0].textContent).toBe(NOTICE)
    expect(
      within(notices[0]).getByRole('link', {name: 'page Contact'})
    ).toHaveAttribute('href', '/contact')
  })

  it('la phrase de virement est absente quand toute impayée a son lien', async () => {
    await renderCard({...PENNYLANE, invoices: [withLink]})

    expect(within(card()).queryByText(/se paient par virement/)).toBeNull()
  })

  it('aucune facture impayée : ni colonne « Règlement » ni phrase', async () => {
    await renderCard({...SITE, landCount: 1, invoices: [settled]})

    expect(
      within(table()).queryByRole('columnheader', {name: 'Règlement'})
    ).toBeNull()
    expect(within(card()).queryByText(/se paient par virement/)).toBeNull()
  })

  it('sous 640 px : « Payer cette facture » avant le PDF, ou « À régler par virement. »', async () => {
    await renderCard({...PENNYLANE, invoices: [withLink, byTransfer, settled]})

    const [first, second, third] =
      within(card()).getAllByTestId('my-invoice-card')
    const pay = within(first).getByRole('link', {name: PAYMENT_LABEL})
    expect(pay).toHaveTextContent('Payer cette facture')
    expect(pay).toHaveAttribute('href', PAYMENT_URL)
    expect(pay).toHaveAttribute('target', '_blank')
    expect(pay).toHaveAttribute('rel', 'noopener noreferrer')
    const pdf = within(first).getByRole('button', {name: /PDF de la facture/})
    expect(
      pay.compareDocumentPosition(pdf) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(second).toHaveTextContent('À régler par virement.')
    expect(within(second).queryByRole('link')).toBeNull()
    expect(third).not.toHaveTextContent(/virement|Payer/)
  })

  it('critère 4 : aucun formulaire ni champ de moyen de paiement', async () => {
    await renderCard({...PENNYLANE, invoices: [withLink, byTransfer, settled]})

    expect(card().querySelector('form')).toBeNull()
    expect(card().querySelector('input, select, textarea')).toBeNull()
    expect(card().innerHTML).not.toMatch(
      /iban|bic|mandat|carte bancaire|cryptogramme|cvv/i
    )
  })
})
