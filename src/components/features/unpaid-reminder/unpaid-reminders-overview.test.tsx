import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  UnpaidReminderMemberDTO,
  UnpaidRemindersOverviewDTO,
} from '@/services/types/domain/unpaid-reminder-types'

import {
  UnpaidRemindersOverview,
  UnpaidRemindersSkeleton,
} from './unpaid-reminders-overview'

const CAMPAIGN_R1 = '33333333-3333-4333-8333-333333333333'
const CAMPAIGN_R2 = '44444444-4444-4444-8444-444444444444'
const PROFILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROFILE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const memberOf = (
  overrides: Partial<UnpaidReminderMemberDTO> = {}
): UnpaidReminderMemberDTO => ({
  id: PROFILE_A,
  name: 'Claire Aubert',
  parcelNumbers: ['12', '14'],
  invoices: [{issuedOn: '2026-02-15', dueOn: '2026-03-31', parcelNumber: '12'}],
  reminders: [{rank: 1, day: '2026-04-21', channel: 'email'}],
  channel: 'email',
  ...overrides,
})

const readyOf = (
  overrides: Partial<
    Extract<UnpaidRemindersOverviewDTO, {status: 'ready'}>
  > = {}
): UnpaidRemindersOverviewDTO => ({
  status: 'ready',
  enabled: true,
  delaysWeeks: [3, 2, 1],
  rankCount: 3,
  schedules: [
    {
      dueOn: '2026-03-31',
      ranks: [
        {
          rank: 1,
          status: 'created',
          campaignId: CAMPAIGN_R1,
          day: '2026-04-21',
          displayState: 'sent',
          recipientCount: 212,
          letterCount: 4,
          receivedCount: 212,
          deferredCount: 0,
          deferredUntil: null,
        },
        {rank: 2, status: 'scheduled', day: '2026-05-05'},
        {rank: 3, status: 'upcoming', day: '2026-05-12'},
      ],
    },
  ],
  members: {
    items: [
      memberOf(),
      memberOf({
        id: PROFILE_C,
        name: 'Hélène Roy',
        parcelNumbers: ['30'],
        invoices: [
          {issuedOn: '2026-02-15', dueOn: '2026-03-31', parcelNumber: '30'},
          {issuedOn: '2026-02-16', dueOn: '2026-03-31', parcelNumber: '31'},
        ],
        reminders: [],
        channel: 'letter',
      }),
    ],
    page: 1,
    pageSize: 25,
    total: 2,
    totalPages: 1,
  },
  counts: {unpaid: 2, byEmail: 1, byLetter: 1},
  ...overrides,
})

const scheduleCard = () =>
  screen
    .getByRole('heading', {level: 2, name: 'Échéance du 31/03/2026'})
    .closest('[data-slot="card"]') as HTMLElement

const rankLine = (rank: number) =>
  within(scheduleCard())
    .getByText(new RegExp(`^Relance ${rank} — `))
    .closest('li') as HTMLElement

describe('UnpaidRemindersOverview — 1a, relance activée avec des impayés', () => {
  it('titre, phrase, bandeau neutre sans icône qui lit les durées des réglages', () => {
    render(<UnpaidRemindersOverview overview={readyOf()} />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Relances des impayés'})
    ).toBeInTheDocument()
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(
      'La relance automatique est activée. Une relance part 3 semaines après l’échéance, puis 2 semaines et 1 semaine plus tard.'
    )
    expect(banner).toHaveClass('bg-muted')
    expect(banner.querySelector('svg')).toBeNull()
    expect(
      within(banner).getByRole('link', {name: 'Modifier dans les réglages'})
    ).toHaveAttribute('href', '/bureau/reglages#reglages-reminder')
  })

  it('calendrier écrit : une ligne par rang, avec son état et ses liens', () => {
    render(<UnpaidRemindersOverview overview={readyOf()} />)

    expect(rankLine(1)).toHaveTextContent('Relance 1 — 21/04/2026')
    expect(rankLine(1)).toHaveTextContent('Envoyée')
    expect(rankLine(1)).toHaveTextContent('212 adresses · 4 courriers')
    expect(
      within(rankLine(1)).getByRole('link', {name: 'Voir l’envoi'})
    ).toHaveAttribute('href', `/bureau/campagnes/${CAMPAIGN_R1}`)
    expect(
      within(rankLine(1)).getByRole('link', {name: 'Courrier postal (4)'})
    ).toHaveAttribute('href', `/bureau/campagnes/${CAMPAIGN_R1}#courrier`)
    expect(rankLine(2)).toHaveTextContent('Relance 2 — 05/05/2026')
    expect(rankLine(2)).toHaveTextContent('Programmée pour le 05/05')
    expect(rankLine(3)).toHaveTextContent('Relance 3 — 12/05/2026')
    expect(rankLine(3)).toHaveTextContent('À venir')
    expect(within(rankLine(2)).queryByRole('link')).toBeNull()
  })

  it('un rang reporté par le budget : « Part entamée », jamais « En échec »', () => {
    const overview = readyOf()
    if (overview.status !== 'ready') throw new Error('ready attendu')
    overview.schedules[0].ranks[1] = {
      rank: 2,
      status: 'created',
      campaignId: CAMPAIGN_R2,
      day: '2026-05-05',
      displayState: 'sending',
      recipientCount: 212,
      letterCount: 0,
      receivedCount: 100,
      deferredCount: 112,
      deferredUntil: '2026-05-06',
    }
    render(<UnpaidRemindersOverview overview={overview} />)

    expect(rankLine(2)).toHaveTextContent('En cours d’envoi')
    expect(rankLine(2)).toHaveTextContent('100 reçues · 112 reportées au 06/05')
    expect(rankLine(2)).not.toHaveTextContent('En échec')
    expect(
      within(rankLine(2)).queryByRole('link', {name: /Courrier postal/})
    ).toBeNull()
  })

  it('compteur, puis tableau : nom, parcelle, facture, relances et envoi', () => {
    render(<UnpaidRemindersOverview overview={readyOf()} />)

    const counter = screen.getByTestId('unpaid-counter')
    expect(counter).toHaveTextContent('Impayés2')
    expect(counter).toHaveTextContent('Par email1')
    expect(counter).toHaveTextContent('Par courrier1')

    const table = screen.getByRole('table')
    const [claire, helene] = within(table).getAllByRole('row').slice(1)
    expect(
      within(claire).getByRole('link', {name: 'Claire Aubert'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_A}`)
    expect(claire).toHaveTextContent('12, 14')
    expect(claire).toHaveTextContent('15/02/2026')
    expect(claire).toHaveTextContent('échéance 31/03/2026')
    expect(claire).toHaveTextContent('1 sur 3')
    expect(claire).toHaveTextContent('21/04')
    expect(claire).toHaveTextContent('Email')
    expect(helene).toHaveTextContent('Aucune')
    expect(helene).toHaveTextContent('16/02/2026')
    const letterBadge = within(helene).getByText('Courrier')
    expect(letterBadge).toHaveAttribute('data-slot', 'badge')
  })

  it('sous 640 px : une carte par fiche, la fiche « Courrier » marquée', () => {
    render(<UnpaidRemindersOverview overview={readyOf()} />)

    const cards = screen.getAllByTestId('unpaid-member-card')
    expect(cards).toHaveLength(2)
    expect(cards[1]).toHaveTextContent('Hélène Roy')
    expect(within(cards[1]).getByText('Courrier')).toHaveAttribute(
      'data-slot',
      'badge'
    )
  })

  it('aucun lien vers un chemin de stockage : tout reste dans le back-office', () => {
    render(<UnpaidRemindersOverview overview={readyOf()} />)

    const hrefs = [...document.querySelectorAll('a')].map(
      (anchor) => anchor.getAttribute('href') ?? anchor.outerHTML
    )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(href).toMatch(/^\/bureau\//)
  })

  it('pied : un statut à classer n’est pas un impayé', () => {
    render(<UnpaidRemindersOverview overview={readyOf()} />)

    expect(
      screen.getByText(
        'Un statut de facture à classer n’est pas un impayé : il n’est pas relancé. Le classement se fait dans les réglages, section Factures.'
      )
    ).toBeInTheDocument()
  })

  it('pagination à 25 : la position est écrite', () => {
    const overview = readyOf()
    if (overview.status !== 'ready') throw new Error('ready attendu')
    overview.members = {...overview.members, page: 2, total: 30, totalPages: 2}
    render(<UnpaidRemindersOverview overview={overview} />)

    const nav = screen.getByRole('navigation', {name: 'Pages des impayés'})
    expect(nav).toHaveTextContent('Page 2 sur 2 · 30 impayés')
    expect(within(nav).getByRole('link', {name: 'Précédent'})).toHaveAttribute(
      'href',
      '/bureau/relances'
    )
  })
})

describe('UnpaidRemindersOverview — autres états', () => {
  it('1b · désactivée : bandeau `warning` et rangs « Non programmée »', () => {
    const overview = readyOf({enabled: false})
    if (overview.status !== 'ready') throw new Error('ready attendu')
    overview.schedules[0].ranks = [
      overview.schedules[0].ranks[0],
      {rank: 2, status: 'not_scheduled', day: '2026-05-05'},
      {rank: 3, status: 'not_scheduled', day: '2026-05-12'},
    ]
    render(<UnpaidRemindersOverview overview={overview} />)

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(
      'La relance automatique est désactivée. Aucune relance ne part ; la liste ci-dessous reste à jour.'
    )
    expect(banner).toHaveClass('bg-warning')
    expect(banner.querySelector('svg')).not.toBeNull()
    expect(
      within(banner).getByRole('link', {name: 'L’activer dans les réglages'})
    ).toHaveAttribute('href', '/bureau/reglages#reglages-reminder')
    expect(rankLine(2)).toHaveTextContent('Non programmée')
    expect(rankLine(3)).toHaveTextContent('Non programmée')
  })

  it('1c · aucun impayé : la file vide se dit, sans tableau', () => {
    render(
      <UnpaidRemindersOverview
        overview={readyOf({
          schedules: [],
          members: {items: [], page: 1, pageSize: 25, total: 0, totalPages: 1},
          counts: {unpaid: 0, byEmail: 0, byLetter: 0},
        })}
      />
    )

    expect(
      screen.getByText(
        'Aucun impayé. Tous les membres sont à jour de leurs factures.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('1d · chargement : skeleton occupé', () => {
    render(<UnpaidRemindersSkeleton />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Relances des impayés'})
    ).toBeInTheDocument()
    expect(
      document.querySelectorAll('[aria-busy="true"]').length
    ).toBeGreaterThan(0)
  })

  it('1e · factures illisibles : alerte `destructive`, jamais une liste vide', () => {
    render(
      <UnpaidRemindersOverview
        overview={{
          status: 'unavailable',
          enabled: true,
          delaysWeeks: [3, 2, 1],
        }}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Les factures ne peuvent pas être lues pour l’instant. La liste reviendra quand la lecture sera rétablie. Aucune relance ne part tant qu’elles sont illisibles.'
    )
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/Aucun impayé/)).toBeNull()
  })
})
