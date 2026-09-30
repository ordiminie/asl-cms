import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {IncidentReportDTO} from '@/services/types/domain/incident-report-types'

import {IncidentReportDetail} from './incident-report-detail'

const REPORT_ID = '33333333-3333-4333-8333-333333333333'

const report = (
  overrides: Partial<IncidentReportDTO> = {}
): IncidentReportDTO => ({
  id: REPORT_ID,
  organizationId: '11111111-1111-4111-8111-111111111111',
  categoryName: "Fuite d'eau",
  categoryDeleted: false,
  location: 'Chemin des Pins, devant la parcelle 47',
  description: 'L’eau sort de la chaussée.\nDéjà une flaque hier soir.',
  reporterName: null,
  reporterEmail: null,
  reporterPhone: null,
  status: 'reported',
  notificationFailed: false,
  createdAt: new Date('2026-09-29T05:42:00Z'),
  events: [
    {
      id: 'e1',
      status: 'reported',
      authorName: null,
      createdAt: new Date('2026-09-29T05:42:00Z'),
    },
  ],
  ...overrides,
})

const changeStatusAction = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  changeStatusAction.mockResolvedValue({status: 'changed'})
})

describe('IncidentReportDetail — écran 3 du design s10', () => {
  it('titre la catégorie avec son statut, date et sections', () => {
    render(
      <IncidentReportDetail
        report={report()}
        changeStatusAction={changeStatusAction}
      />
    )

    const heading = screen.getByRole('heading', {level: 1})
    expect(heading).toHaveTextContent("Fuite d'eau")
    expect(heading.parentElement).toHaveTextContent('Signalé')
    expect(
      screen.getByText('Reçu le 29 septembre 2026 à 07 h 42 depuis le site')
    ).toBeInTheDocument()
    for (const name of ['Où', 'Ce qui a été signalé', 'Coordonnées', 'Suivi']) {
      expect(screen.getByRole('heading', {level: 3, name})).toBeInTheDocument()
    }
    expect(screen.getByTestId('incident-report-description')).toHaveClass(
      'whitespace-pre-line'
    )
    expect(screen.getByText('Aucune coordonnée laissée')).toBeInTheDocument()
  })

  it('rend les coordonnées en mailto: et tel:', () => {
    render(
      <IncidentReportDetail
        report={report({
          reporterName: 'Paul Ferrand',
          reporterEmail: 'p.ferrand@example.fr',
          reporterPhone: '06 12 34 56 78',
        })}
        changeStatusAction={changeStatusAction}
      />
    )

    expect(
      screen.getByRole('link', {name: 'p.ferrand@example.fr'})
    ).toHaveAttribute('href', 'mailto:p.ferrand@example.fr')
    expect(screen.getByRole('link', {name: '06 12 34 56 78'})).toHaveAttribute(
      'href',
      'tel:0612345678'
    )
    expect(screen.queryByText('Aucune coordonnée laissée')).toBeNull()
  })

  it.each([
    ['reported', 'Passer en cours'],
    ['in_progress', 'Marquer comme résolu'],
  ] as const)('un seul bouton pour le statut %s : %s', (status, label) => {
    render(
      <IncidentReportDetail
        report={report({status})}
        changeStatusAction={changeStatusAction}
      />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([label])
  })

  it('aucun bouton pour un signalement résolu', () => {
    render(
      <IncidentReportDetail
        report={report({status: 'resolved'})}
        changeStatusAction={changeStatusAction}
      />
    )

    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.getByText('Signalement résolu.')).toBeInTheDocument()
  })

  it('montre l’historique dans l’ordre, date et auteur', () => {
    render(
      <IncidentReportDetail
        report={report({
          status: 'resolved',
          events: [
            {
              id: 'e1',
              status: 'reported',
              authorName: null,
              createdAt: new Date('2026-09-20T08:05:00Z'),
            },
            {
              id: 'e2',
              status: 'in_progress',
              authorName: 'Marie Delorme',
              createdAt: new Date('2026-09-21T06:30:00Z'),
            },
            {
              id: 'e3',
              status: 'resolved',
              authorName: 'Jean Vidal',
              createdAt: new Date('2026-09-24T15:48:00Z'),
            },
          ],
        })}
        changeStatusAction={changeStatusAction}
      />
    )

    const history = screen.getByRole('list', {
      name: 'Historique du signalement',
    })
    expect(
      within(history)
        .getAllByRole('listitem')
        .map((entry) => entry.textContent)
    ).toEqual([
      '20/09/2026 10:05Signalé depuis le site',
      '21/09/2026 08:30Passé en cours par Marie Delorme',
      '24/09/2026 17:48Marqué comme résolu par Jean Vidal',
    ])
  })

  it('fait avancer le statut et confirme en tête', async () => {
    const user = userEvent.setup()
    render(
      <IncidentReportDetail
        report={report()}
        changeStatusAction={changeStatusAction}
      />
    )

    await user.click(screen.getByRole('button', {name: 'Passer en cours'}))

    expect(changeStatusAction).toHaveBeenCalledWith(REPORT_ID, 'in_progress')
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Signalement passé en cours.'
    )
  })

  it('dit que le signalement avait déjà changé quand la course est perdue', async () => {
    changeStatusAction.mockResolvedValue({
      status: 'stale',
      message: 'Ce signalement avait déjà changé de statut.',
    })
    const user = userEvent.setup()
    render(
      <IncidentReportDetail
        report={report()}
        changeStatusAction={changeStatusAction}
      />
    )

    await user.click(screen.getByRole('button', {name: 'Passer en cours'}))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce signalement avait déjà changé de statut.'
    )
  })

  it('signale une notification non envoyée, avec le lien vers les Réglages', () => {
    render(
      <IncidentReportDetail
        report={report({notificationFailed: true})}
        changeStatusAction={changeStatusAction}
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Rien n’est perdu')
    expect(
      within(alert).getByRole('link', {name: 'Ouvrir les Réglages'})
    ).toHaveAttribute('href', '/bureau/reglages')
  })

  it('dit qu’une catégorie a été supprimée depuis', () => {
    render(
      <IncidentReportDetail
        report={report({categoryName: 'Portail', categoryDeleted: true})}
        changeStatusAction={changeStatusAction}
      />
    )

    expect(
      screen.getByText(
        'Cette catégorie a été supprimée depuis ; le signalement est conservé.'
      )
    ).toBeInTheDocument()
  })
})
