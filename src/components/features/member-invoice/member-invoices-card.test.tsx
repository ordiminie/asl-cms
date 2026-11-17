import {describe, expect, it} from 'vitest'

import {act, render, screen, within} from '@/__tests__/customRender'
import type {
  BoardInvoiceDTO,
  BoardMemberInvoicesDTO,
} from '@/services/types/domain/member-invoice-types'

import {MemberInvoicesCard} from './member-invoices-card'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const SITE_ID = '66666666-6666-4666-8666-666666666666'
const PENNYLANE_ID = '77777777-7777-4777-8777-777777777777'

const invoice = (
  overrides: Partial<BoardInvoiceDTO> = {}
): BoardInvoiceDTO => ({
  id: SITE_ID,
  memberProfileId: PROFILE_ID,
  parcelId: 'p12',
  parcelNumber: '12',
  meterNumber: '0045821',
  source: 'site',
  year: 2026,
  issuedOn: '2026-03-15',
  dueOn: '2026-04-15',
  amountCents: 41250,
  status: 'En attente',
  subject: 'Cotisation et eau 2026',
  statusClass: 'unpaid',
  ...overrides,
})

const MIXED: BoardMemberInvoicesDTO = {
  canWrite: true,
  invoices: [
    invoice(),
    invoice({
      id: PENNYLANE_ID,
      source: 'pennylane',
      issuedOn: '2025-03-15',
      subject: 'Cotisation et eau 2025',
      status: 'Statut jamais vu',
      statusClass: 'unclassified',
    }),
  ],
}

const renderCard = async (invoices: BoardMemberInvoicesDTO, saved = false) => {
  await act(async () => {
    render(
      <MemberInvoicesCard
        memberProfileId={PROFILE_ID}
        memberName="Bernard Lefèvre"
        invoices={invoices}
        saved={saved}
      />
    )
  })
}

const card = () => screen.getByRole('region', {name: 'Factures'})
const rows = () =>
  within(within(card()).getByRole('table'))
    .getAllByRole('row')
    .slice(1) as HTMLTableRowElement[]

describe('MemberInvoicesCard — carte « Factures » de la fiche (s19, écran 2)', () => {
  it('liste mixte : source écrite, statut brut, objet et parcelle', async () => {
    await renderCard(MIXED)

    const [site, pennylane] = rows()
    expect(site).toHaveTextContent('15/03/2026')
    expect(site).toHaveTextContent('Cotisation et eau 2026')
    expect(site).toHaveTextContent('Parcelle 12')
    expect(site).toHaveTextContent('Saisie sur le site')
    expect(pennylane).toHaveTextContent('Pennylane')
    expect(pennylane).toHaveTextContent('Lecture seule')
    expect(pennylane).toHaveTextContent('Statut jamais vu')
  })

  it('« Modifier » pour une facture du site seulement, jamais pour Pennylane (critère 9)', async () => {
    await renderCard(MIXED)

    const [site, pennylane] = rows()
    expect(within(site).getByRole('link', {name: /Modifier/})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}/factures/${SITE_ID}`
    )
    expect(within(pennylane).queryByRole('link')).toBeNull()
    expect(card().innerHTML).not.toContain(`/factures/${PENNYLANE_ID}`)
  })

  it('« Ajouter une facture » quand le fournisseur permet la saisie', async () => {
    await renderCard(MIXED)

    expect(
      within(card()).getByRole('link', {name: 'Ajouter une facture'})
    ).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}/factures/nouvelle`
    )
  })

  it('fournisseur en lecture seule : ni ajout ni modification, les lignes restent lisibles', async () => {
    await renderCard({...MIXED, canWrite: false})

    expect(
      within(card()).queryByRole('link', {name: 'Ajouter une facture'})
    ).toBeNull()
    expect(within(card()).queryByRole('link', {name: /Modifier/})).toBeNull()
    expect(rows()).toHaveLength(2)
  })

  it('vide : la phrase, et l’ajout', async () => {
    await renderCard({canWrite: true, invoices: []})

    expect(
      within(card()).getByText('Aucune facture pour ce propriétaire.')
    ).toBeInTheDocument()
    expect(within(card()).queryByRole('table')).toBeNull()
    expect(
      within(card()).getByRole('link', {name: 'Ajouter une facture'})
    ).toBeInTheDocument()
  })

  it('3c : au retour d’un enregistrement, l’alerte de succès nomme le membre', async () => {
    await renderCard(MIXED, true)

    expect(within(card()).getByRole('status')).toHaveTextContent(
      'Facture enregistrée. Bernard Lefèvre la voit dès maintenant dans son espace'
    )
  })
})
