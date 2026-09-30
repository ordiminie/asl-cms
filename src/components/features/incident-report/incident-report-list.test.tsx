import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  IncidentReportListItemDTO,
  IncidentReportListPageDTO,
} from '@/services/types/domain/incident-report-types'

import {IncidentReportList} from './incident-report-list'

const item = (
  overrides: Partial<IncidentReportListItemDTO> = {}
): IncidentReportListItemDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: '11111111-1111-4111-8111-111111111111',
  categoryName: "Fuite d'eau",
  categoryDeleted: false,
  location: 'Chemin des Pins, devant la parcelle 47',
  reporterName: null,
  reporterEmail: null,
  reporterPhone: null,
  status: 'reported',
  notificationFailed: false,
  createdAt: new Date('2026-09-29T05:42:00Z'),
  ...overrides,
})

const page = (
  items: IncidentReportListItemDTO[],
  overrides: Partial<IncidentReportListPageDTO> = {}
): IncidentReportListPageDTO => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  counts: {reported: 1, in_progress: 1, resolved: 0},
  ...overrides,
})

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('IncidentReportList — écran 2 du design s10', () => {
  it('titre la file, compte les statuts et mène aux catégories', () => {
    render(<IncidentReportList list={page([item()])} />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Signalements'})
    ).toBeInTheDocument()
    expect(
      screen.getByText('1 signalement à traiter · 1 en cours')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer les catégories'})
    ).toHaveAttribute('href', '/bureau/signalements/categories')
  })

  it('garde l’ordre reçu du service', () => {
    render(
      <IncidentReportList
        list={page([
          item({id: 'a', location: 'Premier lieu'}),
          item({id: 'b', location: 'Second lieu'}),
        ])}
      />
    )

    expect(tableRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Premier lieu'),
      expect.stringContaining('Second lieu'),
    ])
  })

  it.each([
    [
      'le nom',
      {reporterName: 'Paul Ferrand', reporterEmail: 'p@example.fr'},
      'Paul Ferrand',
    ],
    [
      'sinon l’email',
      {reporterEmail: 'p.ferrand@example.fr'},
      'p.ferrand@example.fr',
    ],
    ['sinon le téléphone', {reporterPhone: '06 12 34 56 78'}, '06 12 34 56 78'],
    ['sinon « Anonyme »', {}, 'Anonyme'],
  ])('« Signalé par » montre %s', (_label, overrides, expected) => {
    render(<IncidentReportList list={page([item(overrides)])} />)

    const [row] = tableRows()
    const reporterCell = within(row).getAllByRole('cell')[2]
    expect(reporterCell.textContent).toContain(expected)
  })

  it('garde le nom d’une catégorie supprimée, avec la mention', () => {
    render(
      <IncidentReportList
        list={page([item({categoryName: 'Portail', categoryDeleted: true})])}
      />
    )

    const [row] = tableRows()
    const categoryCell = within(row).getAllByRole('cell')[0]
    expect(categoryCell).toHaveTextContent('Portail')
    expect(categoryCell).toHaveTextContent('catégorie supprimée')
  })

  it('écrit « Sans catégorie » pour un signalement qui n’en porte pas', () => {
    render(<IncidentReportList list={page([item({categoryName: null})])} />)

    const [row] = tableRows()
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent(
      'Sans catégorie'
    )
  })

  it('pose le badge de statut et celui de la notification sur la même ligne', () => {
    render(
      <IncidentReportList list={page([item({notificationFailed: true})])} />
    )

    const [row] = tableRows()
    const statusCell = within(row).getAllByRole('cell')[4]
    const badges = statusCell.querySelectorAll('[data-slot="badge"]')
    expect([...badges].map((badge) => badge.textContent)).toEqual([
      'Signalé',
      'Notification non envoyée',
    ])
    expect(badges[0].parentElement).toBe(badges[1].parentElement)
  })

  it.each([
    ['in_progress', 'En cours'],
    ['resolved', 'Résolu'],
  ] as const)('dit le statut %s par le mot', (status, word) => {
    render(<IncidentReportList list={page([item({status})])} />)

    const [row] = tableRows()
    expect(within(row).getAllByRole('cell')[4]).toHaveTextContent(word)
  })

  it('ouvre chaque signalement par son lien', () => {
    render(<IncidentReportList list={page([item()])} />)

    const [row] = tableRows()
    expect(
      within(row).getByRole('link', {name: 'Ouvrir le signalement'})
    ).toHaveAttribute(
      'href',
      '/bureau/signalements/33333333-3333-4333-8333-333333333333'
    )
  })

  it('état vide : mène au formulaire public', () => {
    render(
      <IncidentReportList
        list={page([], {counts: {reported: 0, in_progress: 0, resolved: 0}})}
      />
    )

    expect(
      screen.getByText(
        'Aucun signalement pour l’instant. Les signalements envoyés depuis le site apparaissent ici.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Voir le formulaire de signalement'})
    ).toHaveAttribute('href', '/signaler')
  })
})
