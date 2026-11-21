import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  CampaignPartDTO,
  CampaignStatisticsDTO,
} from '@/services/types/domain/campaign-types'

import {
  CampaignStatisticsCard,
  CampaignStatisticsCardFallback,
} from './campaign-statistics-card'

const partOf = (number: number, day: string): CampaignPartDTO => ({
  number,
  day,
  recipientCount: 100,
  receivedCount: 100,
  toVerifyCount: 0,
  displayState: 'sent',
  deferredUntil: null,
  deferredCount: 0,
})

const ONE_PART = [partOf(1, '2026-11-12')]
const THREE_PARTS = [
  partOf(1, '2026-11-12'),
  partOf(2, '2026-11-13'),
  partOf(3, '2026-11-14'),
]

const available: CampaignStatisticsDTO = {
  state: 'available',
  sentCount: 302,
  uniqueOpens: 154,
  uniqueClicks: 42,
  openRate: 51,
  clickRate: 14,
  readAt: '2026-11-21T09:32:00.000Z',
  fromSnapshot: false,
}

const renderCard = (
  statistics: CampaignStatisticsDTO,
  parts: CampaignPartDTO[] = ONE_PART
) => render(<CampaignStatisticsCard statistics={statistics} parts={parts} />)

const card = () =>
  screen
    .getByRole('heading', {level: 2, name: 'Ouvertures et clics'})
    .closest('[data-slot="card"]') as HTMLElement

const valueOf = (term: string) =>
  within(card()).getByText(term).nextElementSibling as HTMLElement

const expectNoFigure = () => {
  expect(within(card()).queryByRole('definition')).toBeNull()
  expect(card().textContent).not.toMatch(/\d\s?%/)
  expect(card().textContent).not.toMatch(/·/)
}

describe('CampaignStatisticsCard — ouvertures et clics (s30)', () => {
  it('disponibles : envois, ouvertures et clics avec leur taux (critère 1)', () => {
    renderCard(available)

    expect(valueOf('Emails envoyés')).toHaveTextContent('302')
    expect(valueOf('Ouvertures')).toHaveTextContent('154 · 51 %')
    expect(valueOf('Clics')).toHaveTextContent('42 · 14 %')
    expect(card()).toHaveTextContent(
      'Une ouverture ou un clic compte une personne, même si elle ouvre l’email plusieurs fois.'
    )
    expect(card()).toHaveTextContent(
      'Chiffres fournis par Brevo, le service qui envoie vos emails, relevés le 21/11/2026 à 10:32.'
    )
  })

  it('une seule part : pas de phrase de portée', () => {
    renderCard(available, ONE_PART)

    expect(card()).not.toHaveTextContent('Sur l’ensemble de la campagne')
  })

  it('plusieurs parts : chiffres consolidés sur toute la campagne (critère 2)', () => {
    renderCard(available, THREE_PARTS)

    expect(card()).toHaveTextContent(
      'Sur l’ensemble de la campagne : 3 envois, du 12/11/2026 au 14/11/2026.'
    )
  })

  it('dernière part reportée : la portée finit au jour du report', () => {
    renderCard(available, [
      partOf(1, '2026-11-12'),
      {...partOf(2, '2026-11-13'), deferredUntil: '2026-11-16'},
    ])

    expect(card()).toHaveTextContent(
      'Sur l’ensemble de la campagne : 2 envois, du 12/11/2026 au 16/11/2026.'
    )
  })

  it('un vrai zéro consolidé s’affiche 0 · 0 %', () => {
    renderCard({
      ...available,
      uniqueOpens: 0,
      uniqueClicks: 0,
      openRate: 0,
      clickRate: 0,
    })

    expect(valueOf('Ouvertures')).toHaveTextContent('0 · 0 %')
    expect(valueOf('Clics')).toHaveTextContent('0 · 0 %')
  })

  it('campagne en cours : « après le dernier envoi », aucun chiffre (critère 3)', () => {
    renderCard({state: 'pending_sending', lastSendDay: '2026-11-14'})

    const alert = within(card()).getByRole('status')
    expect(alert).toHaveTextContent(
      'Statistiques disponibles après le dernier envoi'
    )
    expect(alert).toHaveTextContent(
      'Les chiffres porteront sur l’ensemble de la campagne. Dernier envoi prévu le 14/11/2026.'
    )
    expect(within(card()).queryByRole('definition')).toBeNull()
  })

  it('fournisseur pas encore à jour : « pas encore disponibles », aucun chiffre (critère 3)', () => {
    renderCard({state: 'pending_provider'})

    const alert = within(card()).getByRole('status')
    expect(alert).toHaveTextContent('Statistiques pas encore disponibles')
    expect(alert).toHaveTextContent(
      'Brevo compte encore les emails de cette campagne.'
    )
    expectNoFigure()
  })

  it.each([
    [
      'unreachable',
      'Brevo n’a pas répondu. Rechargez la page dans quelques minutes.',
    ],
    ['untracked', 'Cette campagne a été envoyée sans suivi des ouvertures.'],
    [
      'unsupported',
      'Le service d’envoi utilisé en ce moment ne fournit pas ces statistiques.',
    ],
    ['expired', 'Brevo ne conserve ces chiffres que 90 jours.'],
  ] as const)(
    'indisponibles (%s) : la phrase et sa raison, sans alerte ni chiffre',
    (reason, text) => {
      renderCard({state: 'unavailable', reason})

      expect(card()).toHaveTextContent(
        'Les statistiques de cette campagne ne sont pas disponibles.'
      )
      expect(card()).toHaveTextContent(text)
      expect(within(card()).queryByRole('status')).toBeNull()
      expectNoFigure()
    }
  )

  it('aucun email parti : rien à mesurer, aucun chiffre', () => {
    renderCard({state: 'nothing_sent'})

    expect(card()).toHaveTextContent(
      'Aucun email n’est parti : il n’y a rien à mesurer.'
    )
    expectNoFigure()
  })
})

describe('CampaignStatisticsCardFallback — chargement', () => {
  it('le titre et « Lecture des statistiques… », sans chiffre', () => {
    render(<CampaignStatisticsCardFallback />)

    expect(card()).toHaveTextContent('Lecture des statistiques…')
    expectNoFigure()
  })
})
