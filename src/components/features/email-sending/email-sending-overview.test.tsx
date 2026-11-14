import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  EmailSendingOverviewDTO,
  PendingSendDTO,
} from '@/services/types/domain/email-send-types'

import {
  EmailSendingError,
  EmailSendingOverview,
  EmailSendingSkeleton,
} from './email-sending-overview'

const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const MESSAGE_ID = '44444444-4444-4444-8444-444444444444'
const REPORT_ID = '55555555-5555-4555-8555-555555555555'

const campaignPart: PendingSendDTO = {
  key: `campaign:${CAMPAIGN_ID}:3`,
  nature: 'campaign',
  reference: {type: 'campaign', id: CAMPAIGN_ID},
  campaignSubject: 'Convocation à l’assemblée générale',
  partNumber: 3,
  partCount: 3,
  recipientCount: 40,
  sendOn: '2026-11-15',
  state: 'scheduled',
}

const contactNotification: PendingSendDTO = {
  key: `contact_message:${MESSAGE_ID}:2026-11-15`,
  nature: 'board_notification',
  reference: {type: 'contact_message', id: MESSAGE_ID},
  campaignSubject: null,
  partNumber: null,
  partCount: null,
  recipientCount: 1,
  sendOn: '2026-11-15',
  state: 'scheduled',
}

const reportNotification: PendingSendDTO = {
  ...contactNotification,
  key: `incident_report:${REPORT_ID}:2026-11-15`,
  reference: {type: 'incident_report', id: REPORT_ID},
}

const overviewOf = (
  overrides: Partial<EmailSendingOverviewDTO> = {}
): EmailSendingOverviewDTO => ({
  day: '2026-11-14',
  limit: 300,
  reserve: 100,
  sentToday: 222,
  loginSentToday: 22,
  remainingReportable: 0,
  limitReached: true,
  reserveExhausted: false,
  pending: [campaignPart, contactNotification, reportNotification],
  pendingRecipientTotal: 42,
  nextSendOn: '2026-11-15',
  ...overrides,
})

const card = (title: string | RegExp) =>
  screen
    .getByRole('heading', {level: 2, name: title})
    .closest('[data-slot="card"]') as HTMLElement

describe('EmailSendingOverview — 1a, limite du jour atteinte, envois en attente', () => {
  it('titre, phrase de la limite réglée, bandeau warning', () => {
    render(<EmailSendingOverview overview={overviewOf()} page={1} />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Envois d’emails'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Votre messagerie envoie au plus 300 emails par jour. Ce qui dépasse part le lendemain, sans action de votre part.'
      )
    ).toBeInTheDocument()
    const banner = screen
      .getByText(/La limite d’envoi du jour est atteinte\./)
      .closest('[data-slot="alert"]') as HTMLElement
    expect(banner).toHaveTextContent(
      'La limite d’envoi du jour est atteinte. 42 emails partiront demain, le 15/11/2026, sans action de votre part. Les emails de connexion continuent de partir.'
    )
    expect(banner).toHaveClass('bg-warning')
    expect(banner).toHaveAttribute('role', 'status')
  })

  it('carte du jour : progression sans pourcentage écrit, quatre paires, réserve expliquée', () => {
    render(<EmailSendingOverview overview={overviewOf()} page={1} />)

    const today = card('Aujourd’hui, samedi 14/11/2026')
    expect(
      within(today).getByText('222 sur 300 emails envoyés aujourd’hui')
    ).toBeInTheDocument()
    const progress = within(today).getByRole('progressbar')
    expect(progress).toHaveAttribute(
      'aria-valuetext',
      '222 sur 300 emails envoyés aujourd’hui'
    )
    expect(today).not.toHaveTextContent('%')
    const pairs = within(today)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent])
    expect(pairs).toEqual([
      ['Envoyés aujourd’hui', '222'],
      ['Dont emails de connexion', '22'],
      ['Autres envois encore possibles', '0'],
      ['Limite remise à zéro', 'à minuit'],
    ])
    expect(today).toHaveTextContent(
      '100 envois sont gardés chaque jour pour les emails de connexion. Ils partent toujours, même quand les autres envois attendent demain.'
    )
  })

  it('carte « En attente » : une ligne par envoi, ni adresse ni contenu, un lien par objet', () => {
    render(<EmailSendingOverview overview={overviewOf()} page={1} />)

    const pending = card('En attente')
    expect(pending).toHaveTextContent(
      'Ces envois partiront seuls le jour indiqué. Vous n’avez rien à faire.'
    )
    const table = within(pending).getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('« Convocation à l’assemblée générale »')
    expect(rows[0]).toHaveTextContent('Part 3 sur 3')
    expect(rows[0]).toHaveTextContent('Campagne')
    expect(rows[0]).toHaveTextContent('40')
    expect(rows[0]).toHaveTextContent('Programmée pour le 15/11')
    expect(within(rows[0]).getByRole('link')).toHaveAttribute(
      'href',
      `/bureau/campagnes/${CAMPAIGN_ID}`
    )
    expect(rows[1]).toHaveTextContent(
      'Message reçu depuis le formulaire de contact'
    )
    expect(rows[1]).toHaveTextContent('Notification au bureau')
    expect(within(rows[1]).getByRole('link')).toHaveAttribute(
      'href',
      `/bureau/messages/${MESSAGE_ID}`
    )
    expect(
      within(rows[2]).getByRole('link', {name: /signalement/})
    ).toHaveAttribute('href', `/bureau/signalements/${REPORT_ID}`)
    expect(pending).not.toHaveTextContent('@')
    expect(screen.queryByRole('button', {name: /Envoyer/})).toBeNull()
  })

  it('un envoi refusé à chaque tentative est « En échec » (destructive), jamais « Programmée » (revue n° 2)', () => {
    const failed: PendingSendDTO = {
      ...reportNotification,
      key: `incident_report:${REPORT_ID}:2026-11-15:failed`,
      state: 'failed',
    }
    render(
      <EmailSendingOverview
        overview={overviewOf({pending: [failed]})}
        page={1}
      />
    )

    const [row] = within(within(card('En attente')).getByRole('table'))
      .getAllByRole('row')
      .slice(1)
    expect(row).not.toHaveTextContent('Programmée')
    const badge = within(row).getByText('En échec')
    expect(badge).toHaveAttribute('data-slot', 'badge')
    expect(badge).toHaveClass('bg-destructive')
  })

  it('cartes empilées sous 640 px, titre de l’envoi en tête', () => {
    render(<EmailSendingOverview overview={overviewOf()} page={1} />)

    const cards = within(card('En attente')).getAllByTestId('pending-send-card')
    expect(cards).toHaveLength(3)
    expect(within(cards[0]).getByRole('heading', {level: 3})).toHaveTextContent(
      '« Convocation à l’assemblée générale »'
    )
  })

  it('25 lignes par page ; « Précédent » inactif en page 1', () => {
    const many = Array.from({length: 30}, (_, index) => ({
      ...contactNotification,
      key: `k${index}`,
    }))
    render(
      <EmailSendingOverview overview={overviewOf({pending: many})} page={1} />
    )

    const pending = card('En attente')
    const rows = within(within(pending).getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(26)
    const pagination = within(pending).getByRole('navigation')
    expect(
      within(pagination).getByRole('button', {name: 'Précédent'})
    ).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(pagination).getByRole('link', {name: 'Suivant'})
    ).toHaveAttribute('href', '/bureau/envois?page=2')
    expect(pagination).toHaveTextContent('Page 1 sur 2 · 30 envois en attente')
  })
})

describe('EmailSendingOverview — 1b, rien en attente', () => {
  it('pas de bandeau ; « Aucun envoi en attente », sans action', () => {
    render(
      <EmailSendingOverview
        overview={overviewOf({
          sentToday: 87,
          loginSentToday: 9,
          remainingReportable: 122,
          limitReached: false,
          pending: [],
          pendingRecipientTotal: 0,
          nextSendOn: null,
        })}
        page={1}
      />
    )

    expect(screen.queryByRole('status')).toBeNull()
    const pending = card('En attente')
    expect(pending).toHaveTextContent(
      'Aucun envoi en attente. Tous les emails sont partis.'
    )
    expect(within(pending).queryByRole('table')).toBeNull()
    expect(within(pending).queryByRole('link')).toBeNull()
    expect(within(pending).queryByRole('button')).toBeNull()
  })
})

describe('EmailSendingOverview — 1c, réserve de connexion épuisée', () => {
  it('un seul bandeau : celui de la réserve', () => {
    render(
      <EmailSendingOverview
        overview={overviewOf({
          sentToday: 300,
          loginSentToday: 100,
          reserveExhausted: true,
        })}
        page={1}
      />
    )

    const banner = screen
      .getByText(/Les 100 envois gardés pour la connexion sont épuisés\./)
      .closest('[data-slot="alert"]') as HTMLElement
    expect(banner).toHaveTextContent(
      'D’ici minuit, votre messagerie peut refuser des emails de connexion. Si cela se reproduit, prévenez l’équipe technique : la limite ou la réserve est peut-être à revoir.'
    )
    expect(banner).toHaveClass('bg-warning')
    expect(
      screen.queryByText(/La limite d’envoi du jour est atteinte/)
    ).toBeNull()
  })
})

describe('EmailSendingSkeleton — 1d, chargement', () => {
  it('titres visibles, squelettes dans les deux cartes', () => {
    render(<EmailSendingSkeleton />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Envois d’emails'})
    ).toBeInTheDocument()
    expect(card(/Aujourd’hui/)).toHaveAttribute('aria-busy', 'true')
    expect(card('En attente')).toHaveAttribute('aria-busy', 'true')
    expect(
      card('En attente').querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})

describe('EmailSendingError — 1e, erreur de lecture', () => {
  it('alerte destructive, rien n’est perdu, sans les cartes', () => {
    render(<EmailSendingError />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Les envois n’ont pas pu être lus. Rien n’est perdu : les envois en attente partiront quand même. Rechargez la page dans un instant.'
    )
    expect(alert).toHaveClass('border-2')
    expect(screen.queryByRole('heading', {level: 2})).toBeNull()
  })
})

describe('EmailSendingOverview — question d’un membre (s23)', () => {
  it('« Question d’un membre », action « Voir la question » vers le bureau', () => {
    const QUESTION_ID = '66666666-6666-4666-8666-666666666666'
    const questionNotification: PendingSendDTO = {
      ...contactNotification,
      key: `member_question:${QUESTION_ID}:2026-11-15`,
      reference: {type: 'member_question', id: QUESTION_ID},
    }
    render(
      <EmailSendingOverview
        overview={overviewOf({pending: [questionNotification]})}
        page={1}
      />
    )

    const [row] = within(within(card('En attente')).getByRole('table'))
      .getAllByRole('row')
      .slice(1)
    expect(row).toHaveTextContent('Question d’un membre')
    expect(
      within(row).getByRole('link', {name: /Voir la question/})
    ).toHaveAttribute('href', `/bureau/questions/${QUESTION_ID}`)
  })
})
