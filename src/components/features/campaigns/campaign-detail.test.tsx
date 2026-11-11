import {describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({refresh: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import {render, screen} from '@/__tests__/customRender'

import {
  CampaignDetail,
  CampaignDetailSkeleton,
  CampaignNotFound,
} from './campaign-detail'
import {campaignOf} from './campaign-test-data'

const renderDetail = (
  overrides: Parameters<typeof campaignOf>[1] = {},
  options: {
    status?: 'sending' | 'sent' | 'interrupted'
    justSent?: boolean
  } = {}
) => {
  const campaign = campaignOf('a', {
    subject: 'Convocation à l’assemblée générale',
    templateId: 'general_assembly',
    ...overrides,
  })
  return render(
    <CampaignDetail
      campaign={campaign}
      status={options.status ?? campaign.status}
      associationName="ASL Les Pins"
      justSent={options.justSent ?? false}
    />
  )
}

describe('CampaignDetail — écran 4 du design s25', () => {
  it('a · normale : h1 = l’objet, badge « Envoyée », résumé aux décomptes figés', () => {
    renderDetail()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Convocation à l’assemblée générale',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Envoyée', {selector: '[data-slot="badge"]'})
    ).toBeInTheDocument()
    for (const text of [
      '12/11/2026 à 14:32',
      'Marie Delorme',
      'Convocation à l’AG',
      'Tous les membres',
      '296',
      '71',
      '15',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(
      screen.getByText(
        'Objet : ASL Les Pins — Convocation à l’assemblée générale'
      )
    ).toBeInTheDocument()
  })

  it('montre le contenu envoyé avec les variables non remplacées', () => {
    renderDetail()

    expect(screen.getByText(/Bonjour \{nom\}/)).toBeInTheDocument()
    expect(
      screen.getByText('{parcelle}', {selector: 'strong'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Chaque membre a reçu ce message avec ses propres valeurs.'
      )
    ).toBeInTheDocument()
  })

  it('aucune action sur une campagne envoyée, hors le retour', () => {
    renderDetail()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(
      screen.getByRole('link', {name: 'Retour aux campagnes'})
    ).toHaveAttribute('href', '/bureau/campagnes')
  })

  it('succès juste après l’envoi (?envoi=1)', () => {
    renderDetail({}, {justSent: true})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Campagne envoyée à 296 membres. Elle est archivée ci-dessous.'
    )
  })

  it('en cours : progress « n sur N membres » et rafraîchissement, sans pourcentage', () => {
    renderDetail(
      {status: 'sending', sentCount: 120, finishedAt: null},
      {status: 'sending', justSent: true}
    )

    expect(
      screen.getByText('Envoi en cours : 120 sur 296 membres.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('L’envoi continue même si vous quittez cette page.')
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByTestId('campaign-progress-refresh')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(
      screen.getByText('En cours', {selector: '[data-slot="badge"]'})
    ).toBeInTheDocument()
    expect(screen.queryByText(/Campagne envoyée à/)).toBeNull()
  })

  it('envoyée : ni progress ni rafraîchissement', () => {
    renderDetail()

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByTestId('campaign-progress-refresh')).toBeNull()
  })

  it('interrompue : alerte « L’envoi s’est arrêté après n membres sur N », sans « Réessayer »', () => {
    renderDetail(
      {status: 'interrupted', sentCount: 120},
      {status: 'interrupted'}
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'L’envoi s’est arrêté après 120 membres sur 296.'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('les 176 autres')
    expect(screen.queryByRole('button', {name: /Réessayer/})).toBeNull()
    expect(
      screen.getByText('Interrompue', {selector: '[data-slot="badge"]'})
    ).toBeInTheDocument()
  })

  it('statut affiché = statut effectif : une campagne « sending » figée s’affiche interrompue', () => {
    renderDetail({status: 'sending', sentCount: 3}, {status: 'interrupted'})

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'après 3 membres sur 296'
    )
  })
})

describe('CampaignNotFound — écran 4, état c', () => {
  it('dit que la campagne n’existe pas ou n’est pas de l’association', () => {
    render(<CampaignNotFound />)

    expect(
      screen.getByText(
        'Cette campagne n’existe pas ou n’appartient pas à votre association.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Retour aux campagnes'})
    ).toHaveAttribute('href', '/bureau/campagnes')
  })
})

describe('CampaignDetailSkeleton — écran 4, état b', () => {
  it('rend des skeletons', () => {
    const {container} = render(<CampaignDetailSkeleton />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})
