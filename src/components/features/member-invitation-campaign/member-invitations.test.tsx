import {beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({refresh: vi.fn(), push: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import userEvent from '@testing-library/user-event'

import {render, screen, waitFor, within} from '@/__tests__/customRender'
import type {CampaignDTO} from '@/services/types/domain/campaign-types'
import type {
  LaunchMemberInvitationsActionResult,
  MemberInvitationsPageDTO,
  RemindNeverSignedInActionResult,
} from '@/services/types/domain/member-invitation-campaign-types'

import {
  MemberInvitationsError,
  MemberInvitationsOverview,
  MemberInvitationsSkeleton,
} from './member-invitations-overview'

const LAUNCH_ID = '33333333-3333-4333-8333-333333333333'
const REMINDER_ID = '44444444-4444-4444-8444-444444444444'
const TODAY = '2026-11-24'

const campaignOf = (
  id: string,
  templateId: 'member_invitation_launch' | 'member_invitation_reminder',
  overrides: Partial<CampaignDTO> = {}
): CampaignDTO => ({
  id,
  subject: 'Votre espace membre vous attend',
  preheader: null,
  bodyMarkdown: 'Bonjour',
  templateId,
  nature: 'statutaire',
  targetKind: 'all_members',
  targetGroupName: null,
  targetGroupDeleted: false,
  recipientCount: 312,
  withoutEmailCount: 71,
  unsubscribedCount: 15,
  sentCount: 312,
  status: 'sent',
  displayState: 'sent',
  recipientCounts: {
    received: 312,
    scheduled: 0,
    sending: 0,
    toVerify: 0,
    failed: 0,
    unsubscribed: 0,
    settled: 0,
    superseded: 0,
  },
  parts: [
    {
      number: 1,
      day: TODAY,
      recipientCount: 312,
      receivedCount: 312,
      toVerifyCount: 0,
      displayState: 'sent',
      deferredUntil: null,
      deferredCount: 0,
      sentDay: TODAY,
    },
  ],
  sendDate: TODAY,
  authorName: 'Anne Martin',
  createdAt: '2026-11-24T09:00:00.000Z',
  updatedAt: '2026-11-24T09:00:00.000Z',
  finishedAt: null,
  ...overrides,
})

const pageOf = (
  overrides: Partial<MemberInvitationsPageDTO> = {}
): MemberInvitationsPageDTO => ({
  launch: null,
  reminders: [],
  launchCounts: {
    nature: 'statutaire',
    profilesWithEmail: 225,
    profilesByLetter: 71,
    profilesRefused: 0,
    profiles: 296,
    recipients: 312,
    unsubscribed: 15,
    pendingAddresses: 3,
  },
  reminderCounts: {
    nature: 'statutaire',
    recipients: 142,
    neverInvited: 6,
    unsubscribed: 9,
    pendingAddresses: 3,
  },
  plan: {
    today: TODAY,
    dailySendCap: 400,
    allottedToday: 0,
    parts: [{day: TODAY, count: 312}],
  },
  linkDays: 7,
  overview: {
    invited: 3,
    signedIn: 1,
    neverSignedIn: 2,
    pending: 1,
    coverage: {byEmail: 225, byLetter: 71, neither: 0},
    refusedProfiles: [],
    addresses: {
      items: [
        {
          email: 'partagee@example.fr',
          profiles: [
            {id: 'p-a', name: 'Aubry', parcelNumbers: ['21']},
            {id: 'p-b', name: 'Bernard', parcelNumbers: ['22']},
          ],
          pending: false,
          lastInvitedAt: '2026-11-24T09:00:00.000Z',
          addedAt: '2026-11-01T09:00:00.000Z',
        },
        {
          email: 'nouvelle@example.fr',
          profiles: [{id: 'p-c', name: 'Caron', parcelNumbers: ['30']}],
          pending: false,
          lastInvitedAt: null,
          addedAt: '2026-11-28T09:00:00.000Z',
        },
        {
          email: 'attente@example.fr',
          profiles: [{id: 'p-d', name: 'Dupuis', parcelNumbers: []}],
          pending: true,
          lastInvitedAt: null,
          addedAt: '2026-11-20T09:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 25,
      total: 3,
      totalPages: 1,
      pendingCount: 1,
    },
  },
  ...overrides,
})

const launched = (
  overrides: Partial<CampaignDTO> = {},
  inProgress = false
) => ({
  campaign: campaignOf(LAUNCH_ID, 'member_invitation_launch', overrides),
  inProgress,
})

const launchAction = vi.fn<() => Promise<LaunchMemberInvitationsActionResult>>()
const remindAction =
  vi.fn<(submissionId: string) => Promise<RemindNeverSignedInActionResult>>()

const renderPage = (page: MemberInvitationsPageDTO = pageOf()) =>
  render(
    <MemberInvitationsOverview
      page={page}
      launchAction={launchAction}
      remindAction={remindAction}
    />
  )

const cardOf = (name: string) =>
  screen
    .getByRole('heading', {level: 2, name})
    .closest('[data-slot="card"]') as HTMLElement

beforeEach(() => {
  vi.clearAllMocks()
  launchAction.mockResolvedValue({status: 'created', campaignId: LAUNCH_ID})
  remindAction.mockResolvedValue({status: 'created', campaignId: REMINDER_ID})
})

describe('écran 1 — avant le lancement (1a, 1b)', () => {
  it('1a · titre, décompte en fiches puis en adresses, un seul bouton, aucune relance', () => {
    renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Invitations des membres'})
    ).toBeInTheDocument()
    const launch = within(cardOf('Lancement'))
    expect(
      launch.getByText(
        'Avec au moins une adresse email active — reçoivent l’invitation'
      ).nextElementSibling
    ).toHaveTextContent('225')
    expect(
      launch.getByText('Sans adresse email active — reçoivent le courrier')
        .nextElementSibling
    ).toHaveTextContent('71')
    expect(
      launch.getByText(
        'Dont désinscrites des campagnes — elles la reçoivent : c’est un envoi statutaire'
      ).nextElementSibling
    ).toHaveTextContent('15')
    expect(
      launch.queryByText(
        'Toutes leurs adresses désinscrites — ne reçoivent rien'
      )
    ).toBeNull()
    expect(
      launch.getByRole('button', {name: 'Lancer les invitations'})
    ).toBeInTheDocument()
    expect(
      launch.getByRole('link', {name: 'Réglages › Invitation des membres'})
    ).toHaveAttribute('href', '/bureau/reglages#reglages-invitation')
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'Relancer les jamais connectés',
      })
    ).toBeNull()
  })

  it('1a · en facultative, les fiches qui ne reçoivent rien sont comptées, les désinscrites exclues', () => {
    renderPage(
      pageOf({
        launchCounts: {
          ...pageOf().launchCounts,
          nature: 'facultative',
          profilesRefused: 2,
        },
      })
    )

    const launch = within(cardOf('Lancement'))
    expect(
      launch.getByText('Toutes leurs adresses désinscrites — ne reçoivent rien')
        .nextElementSibling
    ).toHaveTextContent('2')
    expect(
      launch.getByText('Désinscrites — exclues : c’est un envoi facultatif')
    ).toBeInTheDocument()
  })

  it('1b · la confirmation écrit les fiches, le plan, le courrier et la durée du lien', async () => {
    renderPage(
      pageOf({
        plan: {
          today: TODAY,
          dailySendCap: 100,
          allottedToday: 0,
          parts: [
            {day: TODAY, count: 100},
            {day: '2026-11-25', count: 100},
            {day: '2026-11-27', count: 12},
          ],
        },
      })
    )

    await userEvent.click(
      screen.getByRole('button', {name: 'Lancer les invitations'})
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByRole('heading', {name: 'Lancer les invitations ?'})
    ).toBeInTheDocument()
    expect(dialog).toHaveTextContent(
      '225 fiches reçoivent l’invitation par email (312 adresses) · 71 fiches reçoivent le courrier.'
    )
    expect(dialog).toHaveTextContent('Le lancement part en 3 jours :')
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual([
      '100 adresses aujourd’hui',
      '100 adresses demain',
      '12 adresses le 27/11/2026',
    ])
    expect(dialog).toHaveTextContent(
      'Le courrier des 71 fiches sera prêt à télécharger dès aujourd’hui.'
    )
    expect(dialog).toHaveTextContent(
      'Chaque lien de connexion vaut 7 jours à partir de son envoi.'
    )
    expect(
      within(dialog).getByRole('button', {name: 'Revenir'})
    ).toBeInTheDocument()
  })

  it('1b · un seul jour : « Il part en une seule fois, aujourd’hui. »', async () => {
    renderPage()

    await userEvent.click(
      screen.getByRole('button', {name: 'Lancer les invitations'})
    )
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Il part en une seule fois, aujourd’hui.'
    )
  })

  it('1c · confirmé : l’action part une fois, la page se relit, « Lancement parti. »', async () => {
    renderPage()

    await userEvent.click(
      screen.getByRole('button', {name: 'Lancer les invitations'})
    )
    await userEvent.click(
      await screen.findByRole('button', {name: 'Envoyer le lancement'})
    )

    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
    expect(launchAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Lancement parti.')
  })
})

describe('écran 1 — refus et échecs, ancrés dans la carte (1i, 1j)', () => {
  const launchAndConfirm = async () => {
    renderPage()
    await userEvent.click(
      screen.getByRole('button', {name: 'Lancer les invitations'})
    )
    await userEvent.click(
      await screen.findByRole('button', {name: 'Envoyer le lancement'})
    )
  }

  it('1i · lancement déjà envoyé : la date, l’auteur, le lien vers l’envoi', async () => {
    launchAction.mockResolvedValue({
      status: 'already_launched',
      campaignId: LAUNCH_ID,
      sendDate: TODAY,
      authorName: 'Anne Martin',
    })

    await launchAndConfirm()

    const launch = within(cardOf('Lancement'))
    expect(
      await launch.findByText(/Le lancement a déjà été envoyé/)
    ).toBeInTheDocument()
    expect(cardOf('Lancement')).toHaveTextContent(
      'le 24/11/2026 par Anne Martin. Rien n’est reparti.'
    )
    expect(launch.getByRole('link', {name: 'Voir l’envoi'})).toHaveAttribute(
      'href',
      `/bureau/campagnes/${LAUNCH_ID}`
    )
  })

  it('1i · association sans adresse de site : avertissement, rien n’est parti', async () => {
    launchAction.mockResolvedValue({status: 'no_site_address'})

    await launchAndConfirm()

    expect(
      await within(cardOf('Lancement')).findByText(
        'Le lancement attend la mise en ligne du site.'
      )
    ).toBeInTheDocument()
  })

  it('1i · envois aux membres coupés : avertissement', async () => {
    launchAction.mockResolvedValue({status: 'delivery_disabled'})

    await launchAndConfirm()

    expect(
      await within(cardOf('Lancement')).findByText(
        'Les envois d’emails aux membres sont coupés.'
      )
    ).toBeInTheDocument()
  })

  it('1j · échec à la création : alerte destructive, le bouton reste, jamais un toast', async () => {
    launchAction.mockResolvedValue({status: 'error', message: 'échec'})

    await launchAndConfirm()

    const alert = await within(cardOf('Lancement')).findByRole('alert')
    expect(alert).toHaveTextContent('Le lancement n’est pas parti.')
    expect(
      screen.getByRole('button', {name: 'Lancer les invitations'})
    ).toBeEnabled()
    expect(router.refresh).not.toHaveBeenCalled()
  })
})

describe('écran 1 — après le lancement (1c à 1h)', () => {
  it('1e · terminé : la ligne du lancement remplace le bouton pour toujours', () => {
    renderPage(pageOf({launch: launched()}))

    const launch = within(cardOf('Lancement'))
    expect(
      launch.queryByRole('button', {name: 'Lancer les invitations'})
    ).toBeNull()
    expect(launch.getByText('Lancement — 24/11/2026')).toBeInTheDocument()
    expect(launch.getByText('Envoyée')).toBeInTheDocument()
    expect(cardOf('Lancement')).toHaveTextContent(
      '312 adresses · 71 courriers · par Anne Martin'
    )
    expect(launch.getByRole('link', {name: 'Voir l’envoi'})).toHaveAttribute(
      'href',
      `/bureau/campagnes/${LAUNCH_ID}`
    )
    expect(
      launch.getByRole('link', {name: 'Courrier postal (71)'})
    ).toHaveAttribute('href', `/bureau/campagnes/${LAUNCH_ID}#courrier`)
  })

  it('1d · reporté par le budget : un succès différé, jamais une erreur', () => {
    renderPage(
      pageOf({
        launch: launched(
          {
            status: 'sending',
            displayState: 'sending',
            parts: [
              {
                ...campaignOf(LAUNCH_ID, 'member_invitation_launch').parts[0],
                receivedCount: 200,
                displayState: 'scheduled',
                deferredUntil: '2026-11-25',
                deferredCount: 112,
                sentDay: null,
              },
            ],
          },
          true
        ),
      })
    )

    const launch = within(cardOf('Lancement'))
    expect(cardOf('Lancement')).toHaveTextContent(
      'Le lancement continue seul : 112 adresses le recevront le 25/11/2026, la limite d’envois du jour étant atteinte. Vous n’avez rien à faire.'
    )
    expect(launch.queryByText('En échec')).toBeNull()
  })

  it('la carte « Relancer » apparaît après le lancement, avec son décompte et son bouton', () => {
    renderPage(pageOf({launch: launched()}))

    const reminder = within(cardOf('Relancer les jamais connectés'))
    expect(
      reminder.getByText('Adresses qui recevront la relance').nextElementSibling
    ).toHaveTextContent('142')
    expect(
      reminder.getByText('Dont jamais invitées — ajoutées depuis le lancement')
        .nextElementSibling
    ).toHaveTextContent('6')
    expect(
      reminder.getByRole('button', {name: 'Relancer les jamais connectés'})
    ).toBeInTheDocument()
  })

  it('1g · le lancement encore en cours : une phrase à la place du bouton', () => {
    renderPage(
      pageOf({
        launch: launched({status: 'sending', displayState: 'sending'}, true),
      })
    )

    const reminder = within(cardOf('Relancer les jamais connectés'))
    expect(reminder.queryByRole('button')).toBeNull()
    expect(
      reminder.getByText(
        'Le lancement est en cours d’envoi : vous pourrez relancer quand il sera entièrement parti.'
      )
    ).toBeInTheDocument()
  })

  it('1g · une relance encore en cours : sa ligne, et la phrase de la relance', () => {
    renderPage(
      pageOf({
        launch: launched(),
        reminders: [
          {
            campaign: campaignOf(REMINDER_ID, 'member_invitation_reminder', {
              sendDate: '2026-12-01',
              recipientCount: 142,
              withoutEmailCount: 0,
              status: 'sending',
              displayState: 'sending',
            }),
            inProgress: true,
          },
        ],
      })
    )

    const reminder = within(cardOf('Relancer les jamais connectés'))
    expect(reminder.getByText('Relance — 01/12/2026')).toBeInTheDocument()
    expect(reminder.queryByRole('button')).toBeNull()
    expect(
      reminder.getByText(
        'Une relance est en cours d’envoi : vous pourrez relancer quand elle sera entièrement partie.'
      )
    ).toBeInTheDocument()
  })

  it('1h · personne à relancer : une annonce sans action', () => {
    renderPage(
      pageOf({
        launch: launched(),
        reminderCounts: {...pageOf().reminderCounts, recipients: 0},
      })
    )

    const reminder = within(cardOf('Relancer les jamais connectés'))
    expect(reminder.queryByRole('button')).toBeNull()
    expect(
      reminder.getByText(
        'Personne à relancer : toutes les adresses actives se sont connectées au moins une fois.'
      )
    ).toBeInTheDocument()
  })

  it('1f · la relance confirmée part avec une soumission tirée à l’ouverture', async () => {
    renderPage(pageOf({launch: launched()}))

    await userEvent.click(
      screen.getByRole('button', {name: 'Relancer les jamais connectés'})
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByRole('heading', {name: 'Relancer 142 adresses ?'})
    ).toBeInTheDocument()
    expect(dialog).toHaveTextContent(
      'Elle part en une seule fois, aujourd’hui. Aucun courrier n’est produit.'
    )
    expect(dialog).toHaveTextContent(
      'Les adresses connectées entre-temps sont écartées au moment de l’envoi.'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Envoyer la relance'})
    )

    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
    expect(remindAction).toHaveBeenCalledTimes(1)
    expect(remindAction.mock.calls[0][0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('1i · relance refusée : en cours ailleurs, rien n’est reparti', async () => {
    remindAction.mockResolvedValue({status: 'in_progress'})
    renderPage(pageOf({launch: launched()}))

    await userEvent.click(
      screen.getByRole('button', {name: 'Relancer les jamais connectés'})
    )
    await userEvent.click(
      await screen.findByRole('button', {name: 'Envoyer la relance'})
    )

    expect(
      await within(cardOf('Relancer les jamais connectés')).findByText(
        'Un envoi est encore en cours : rien n’est reparti.'
      )
    ).toBeInTheDocument()
  })
})

describe('écran 2 — suivi par adresse (2a à 2e)', () => {
  it('compteur en adresses, couverture en fiches', () => {
    renderPage()

    const tracking = within(cardOf('Suivi'))
    const valueOf = (term: string) =>
      tracking.getByText(term).nextElementSibling?.textContent
    expect(valueOf('Invitations envoyées')).toBe('3')
    expect(valueOf('Adresses connectées')).toBe('1')
    expect(valueOf('Jamais connectées')).toBe('2')
    expect(valueOf('En attente')).toBe('1')
    expect(valueOf('Par email')).toBe('225')
    expect(valueOf('Par courrier')).toBe('71')
    expect(valueOf('Ni l’un ni l’autre')).toBe('0')
  })

  it('une ligne par adresse ; une adresse partagée a un seul état sur ses deux fiches ; l’attente est marquée', () => {
    renderPage()

    const card = cardOf('Adresses jamais connectées')
    expect(card).toHaveTextContent(
      '3 adresses — dont 1 en attente de confirmation, qui ne reçoit rien.'
    )
    const table = within(card).getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('partagee@example.fr')
    expect(rows[0]).toHaveTextContent(
      'Même adresse sur 2 fiches : un seul état'
    )
    expect(within(rows[0]).getByRole('link', {name: 'Aubry'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires/p-a'
    )
    expect(
      within(rows[0]).getByRole('link', {name: 'Bernard'})
    ).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent('Invitée le 24/11/2026')
    expect(rows[1]).toHaveTextContent('Jamais invitée')
    expect(rows[1]).toHaveTextContent('ajoutée le 28/11/2026')
    expect(rows[2]).toHaveTextContent('En attente de confirmation')
    expect(rows[2]).toHaveTextContent(
      'ne reçoit rien tant qu’elle n’est pas confirmée'
    )
    expect(within(table).queryByRole('button')).toBeNull()
  })

  it('2d · liste vide : une annonce sans action', () => {
    renderPage(
      pageOf({
        overview: {
          ...pageOf().overview,
          neverSignedIn: 0,
          pending: 0,
          addresses: {
            items: [],
            page: 1,
            pageSize: 25,
            total: 0,
            totalPages: 1,
            pendingCount: 0,
          },
        },
      })
    )

    expect(cardOf('Adresses jamais connectées')).toHaveTextContent(
      'Aucune adresse en attente de première connexion. Toutes les adresses se sont connectées au moins une fois.'
    )
  })

  it('2c · lancement facultatif : les fiches qui ont tout refusé sont listées à part', () => {
    renderPage(
      pageOf({
        launch: launched({nature: 'facultative'}),
        overview: {
          ...pageOf().overview,
          coverage: {byEmail: 223, byLetter: 71, neither: 2},
          refusedProfiles: [
            {id: 'p-r', name: 'Roy', parcelNumbers: ['3']},
            {id: 'p-s', name: 'Simon', parcelNumbers: ['4']},
          ],
        },
      })
    )

    const card = cardOf('Ont refusé les envois facultatifs')
    expect(card).toHaveTextContent(
      'Ces 2 fiches n’ont reçu ni email ni courrier'
    )
    expect(within(card).getByRole('link', {name: 'Roy'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires/p-r'
    )
  })

  it('statutaire : aucune carte « Ont refusé »', () => {
    renderPage(pageOf({launch: launched()}))

    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'Ont refusé les envois facultatifs',
      })
    ).toBeNull()
  })

  it('pagination écrite quand les adresses dépassent une page', () => {
    renderPage(
      pageOf({
        overview: {
          ...pageOf().overview,
          addresses: {
            ...pageOf().overview.addresses,
            page: 2,
            total: 30,
            totalPages: 2,
          },
        },
      })
    )

    const nav = screen.getByRole('navigation', {
      name: 'Pages des adresses jamais connectées',
    })
    expect(within(nav).getByRole('link', {name: 'Précédent'})).toHaveAttribute(
      'href',
      '/bureau/invitations'
    )
    expect(nav).toHaveTextContent('Page 2 sur 2')
  })
})

describe('chargement et lecture impossible (1k, 1l, 2e)', () => {
  it('1l · lecture impossible : une alerte, jamais un décompte à zéro', () => {
    render(<MemberInvitationsError />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Les invitations ne peuvent pas être lues pour l’instant.'
    )
    expect(screen.queryByText('0')).toBeNull()
  })

  it('1k · chargement : squelettes occupés', () => {
    render(<MemberInvitationsSkeleton />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Invitations des membres'})
    ).toBeInTheDocument()
    expect(
      document.querySelectorAll('[aria-busy="true"]').length
    ).toBeGreaterThan(0)
  })
})
