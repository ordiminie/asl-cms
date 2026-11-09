import {describe, expect, it} from 'vitest'

import {act, render, screen, within} from '@/__tests__/customRender'
import type {MyIncidentReportDTO} from '@/services/types/domain/incident-report-types'

import {MyReportsCard, MyReportsCardLoading} from './my-reports-card'

const REPORTS: MyIncidentReportDTO[] = [
  {
    id: 'r1',
    categoryName: 'Fuite d’eau',
    location: 'chemin des Pins, devant la parcelle 47',
    status: 'reported',
    createdAt: new Date('2026-11-04T10:00:00Z'),
    updatedAt: null,
  },
  {
    id: 'r2',
    categoryName: 'Éclairage',
    location: 'lampadaire éteint au portail nord',
    status: 'in_progress',
    createdAt: new Date('2026-10-28T10:00:00Z'),
    updatedAt: new Date('2026-11-02T10:00:00Z'),
  },
  {
    id: 'r3',
    categoryName: null,
    location: 'nid-de-poule rue des Tilleuls',
    status: 'resolved',
    createdAt: new Date('2026-10-12T10:00:00Z'),
    updatedAt: new Date('2026-10-19T10:00:00Z'),
  },
]

const renderCard = async (reports: MyIncidentReportDTO[], sent = false) => {
  await act(async () => {
    render(<MyReportsCard reports={reports} sent={sent} />)
  })
}

const card = () => screen.getByRole('region', {name: 'Mes signalements'})
const reportButton = () =>
  screen.getByRole('link', {name: 'Signaler une fuite ou un incident'})

describe('MyReportsCard — écran A du design s22', () => {
  it('A1 : une ligne par signalement, dans l’ordre reçu, statut et dates', async () => {
    await renderCard(REPORTS)

    const rows = within(card()).getAllByRole('listitem')
    expect(rows).toHaveLength(3)

    expect(rows[0]).toHaveTextContent('Fuite d’eau')
    expect(rows[0]).toHaveTextContent('chemin des Pins, devant la parcelle 47')
    expect(rows[0]).toHaveTextContent('Envoyé le 04/11/2026')
    expect(rows[0]).not.toHaveTextContent('Mis à jour le')
    expect(within(rows[0]).getByText('Signalé')).toBeInTheDocument()

    expect(rows[1]).toHaveTextContent('Envoyé le 28/10/2026')
    expect(rows[1]).toHaveTextContent('Mis à jour le 02/11/2026')
    expect(within(rows[1]).getByText('En cours')).toBeInTheDocument()

    expect(rows[2]).toHaveTextContent('Sans catégorie')
    expect(within(rows[2]).getByText('Résolu')).toBeInTheDocument()
  })

  it('A1 : le lieu tient sur une ligne', async () => {
    await renderCard(REPORTS)

    expect(
      screen.getByText('chemin des Pins, devant la parcelle 47')
    ).toHaveClass('truncate')
  })

  it('A1 : le bouton « Signaler… » mène au formulaire, en outline, sans bouton default', async () => {
    await renderCard(REPORTS)

    expect(reportButton()).toHaveAttribute('href', '/dashboard/signaler')
    expect(reportButton()).toHaveClass('border-input')
    expect(
      card().querySelectorAll('[data-slot="button"].bg-primary')
    ).toHaveLength(0)
  })

  it('A2 : vide, une phrase d’invitation et le bouton', async () => {
    await renderCard([])

    expect(
      screen.getByText('Vous n’avez encore fait aucun signalement.')
    ).toBeInTheDocument()
    expect(within(card()).queryAllByRole('listitem')).toHaveLength(0)
    expect(reportButton()).toBeInTheDocument()
  })

  it('A5 : au retour d’un envoi, l’alerte de succès en tête de carte', async () => {
    await renderCard(REPORTS, true)

    const status = within(card()).getByRole('status')
    expect(status).toHaveTextContent(
      'Signalement envoyé. Le bureau de l’association l’a reçu.'
    )
  })

  it('sans retour d’envoi, aucune alerte', async () => {
    await renderCard(REPORTS)

    expect(within(card()).queryByRole('status')).toBeNull()
  })
})

describe('MyReportsCardLoading — A3', () => {
  it('garde le titre et le bouton visibles, la liste en skeleton', () => {
    render(<MyReportsCardLoading />)

    expect(card()).toHaveAttribute('aria-busy', 'true')
    expect(
      card().querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(reportButton()).toHaveAttribute('href', '/dashboard/signaler')
  })
})
