import {describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({refresh: vi.fn(), push: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  CampaignDTO,
  CampaignRecipientsPageDTO,
} from '@/services/types/domain/campaign-types'

import {
  CampaignDetail,
  CampaignDetailSkeleton,
  CampaignNotFound,
} from './campaign-detail'
import {
  campaignOf,
  partOf,
  recipientOf,
  recipientsPageOf,
  spreadCampaignOf,
} from './campaign-test-data'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()
Element.prototype.scrollIntoView = vi.fn()

const SUBJECT = 'Convocation à l’assemblée générale'

const renderDetail = (
  campaign: CampaignDTO = campaignOf('a'),
  options: {
    justSent?: boolean
    recipients?: CampaignRecipientsPageDTO | null
  } = {}
) =>
  render(
    <CampaignDetail
      campaign={{...campaign, subject: SUBJECT, templateId: 'general_assembly'}}
      recipients={
        options.recipients === undefined
          ? recipientsPageOf([recipientOf('r1')])
          : options.recipients
      }
      associationName="ASL Les Pins"
      dailySendCap={100}
      justSent={options.justSent ?? false}
    />
  )

const card = (title: string) =>
  screen
    .getByRole('heading', {level: 2, name: title})
    .closest('[data-slot="card"]') as HTMLElement

const badge = (text: string) =>
  screen.getAllByText(text, {selector: '[data-slot="badge"]'})[0]

describe('CampaignDetail — écran 2 de s26, campagne étalée', () => {
  it('a · en cours, part 3 programmée : bandeau neutre sans icône, badge « En cours d’envoi »', () => {
    renderDetail(spreadCampaignOf('a'))

    expect(
      screen.getByRole('heading', {level: 1, name: SUBJECT})
    ).toBeInTheDocument()
    expect(badge('En cours d’envoi')).toHaveClass('bg-secondary')
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(
      'Les envois continuent seuls. Prochaine part : le 14/11/2026, 96 membres. Vous n’avez rien à faire.'
    )
    expect(banner.querySelector('svg')).toBeNull()
    expect(banner).toHaveClass('bg-muted')
  })

  it('a · une part programmée pour demain est « Programmée », jamais interrompue ni bloquée', () => {
    renderDetail(spreadCampaignOf('a'))

    const parts = card('Envois par jour')
    expect(
      within(parts).getAllByText('Programmée pour le 14/11').length
    ).toBeGreaterThan(0)
    expect(document.body).not.toHaveTextContent(/interrompue|bloquée/i)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('carte Avancement : « n sur N » sans pourcentage, compteur à quatre valeurs en dl', () => {
    renderDetail(spreadCampaignOf('a'))

    const progress = card('Avancement')
    expect(progress).toHaveTextContent(
      '200 sur 296 membres ont reçu la campagne.'
    )
    const bar = within(progress).getByRole('progressbar')
    expect(bar).toHaveAttribute(
      'aria-valuetext',
      '200 sur 296 membres ont reçu la campagne.'
    )
    expect(progress).not.toHaveTextContent('%')
    const terms = within(progress)
      .getAllByRole('term')
      .map((term) => term.textContent)
    expect(terms).toEqual(['Reçue', 'Programmée', 'À vérifier', 'En échec'])
    const values = within(progress)
      .getAllByRole('definition')
      .map((value) => value.textContent)
    expect(values).toEqual(['200', '96', '0', '0'])
    expect(progress.querySelector('dl')).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-4'
    )
  })

  it('carte « Envois par jour » : une ligne par part, cartes empilées sous 640 px', () => {
    renderDetail(spreadCampaignOf('a'))

    const parts = card('Envois par jour')
    const table = within(parts).getByRole('table')
    expect(table.closest('.hidden')).toHaveClass('sm:block')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      '112/11/2026100Envoyée',
      '213/11/2026100Envoyée',
      '314/11/202696Programmée pour le 14/11',
    ])
    expect(within(parts).getAllByTestId('campaign-part-card')).toHaveLength(3)
  })

  it('h · envoi unique : pas de carte « Envois par jour »', () => {
    renderDetail(campaignOf('a'))

    expect(
      screen.queryByRole('heading', {level: 2, name: 'Envois par jour'})
    ).toBeNull()
  })

  it('relit la page seulement tant qu’une part est en cours d’envoi', () => {
    const {unmount} = renderDetail(spreadCampaignOf('a'))
    expect(screen.queryByTestId('campaign-progress-refresh')).toBeNull()
    unmount()

    renderDetail(
      spreadCampaignOf('a', {
        parts: [
          partOf(1, '2026-11-12', 100),
          partOf(2, '2026-11-13', 100, {
            displayState: 'sending',
            receivedCount: 40,
          }),
          partOf(3, '2026-11-14', 96, {
            displayState: 'scheduled',
            receivedCount: 0,
          }),
        ],
      })
    )
    expect(screen.getByTestId('campaign-progress-refresh')).toBeInTheDocument()
  })

  it('b · terminée : succès neutre, badge « Envoyée »', () => {
    renderDetail(campaignOf('a'))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Campagne terminée : les 296 membres l’ont reçue.'
    )
    expect(badge('Envoyée')).toHaveClass('text-muted-foreground')
    expect(screen.queryByTestId('campaign-progress-refresh')).toBeNull()
  })

  it('c · à vérifier : avertissement et lien qui applique le filtre', () => {
    renderDetail(
      campaignOf('a', {
        displayState: 'to_verify',
        recipientCounts: {
          received: 294,
          scheduled: 0,
          sending: 0,
          toVerify: 2,
          failed: 0,
          unsubscribed: 0,
        },
      })
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-warning')
    expect(alert).toHaveTextContent(
      'Attention : 2 destinataires sont à vérifier. L’envoi s’est arrêté au moment où l’on ne savait pas si leur email était parti. Nous ne le renvoyons pas, pour ne pas leur écrire deux fois. Contactez l’équipe technique pour les vérifier.'
    )
    expect(
      within(alert).getByRole('link', {
        name: 'Afficher les destinataires à vérifier (2)',
      })
    ).toHaveAttribute('href', '/bureau/campagnes/a?statut=a-verifier')
    expect(badge('À vérifier').querySelector('.bg-primary')).not.toBeNull()
  })

  it('d · en échec : alerte destructive qui nomme la part et ce qui n’est pas renvoyé', () => {
    renderDetail(
      spreadCampaignOf('a', {
        status: 'interrupted',
        displayState: 'failed',
        sentCount: 100,
        recipientCounts: {
          received: 100,
          scheduled: 0,
          sending: 0,
          toVerify: 0,
          failed: 196,
          unsubscribed: 0,
        },
        parts: [
          partOf(1, '2026-11-12', 100),
          partOf(2, '2026-11-13', 100, {
            displayState: 'failed',
            receivedCount: 0,
          }),
          partOf(3, '2026-11-14', 96, {
            displayState: 'failed',
            receivedCount: 0,
          }),
        ],
      })
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('border-2')
    expect(alert).toHaveTextContent(
      'La part du 13/11/2026 n’a pas pu partir après plusieurs essais.'
    )
    expect(alert).toHaveTextContent(
      '100 membres ont reçu la campagne ; 196 ne l’ont pas reçue. Rien n’est renvoyé à ceux qui l’ont déjà reçue. Contactez l’équipe technique.'
    )
    expect(badge('En échec')).toHaveClass('bg-destructive')
    expect(
      screen.queryByRole('button', {name: /Réessayer|Renvoyer/})
    ).toBeNull()
  })

  it('j · juste après la confirmation : « Campagne lancée », la suite part seule', () => {
    renderDetail(
      spreadCampaignOf('a', {
        sentCount: 0,
        recipientCounts: {
          received: 0,
          scheduled: 296,
          sending: 0,
          toVerify: 0,
          failed: 0,
          unsubscribed: 0,
        },
        parts: [
          partOf(1, '2026-11-12', 100, {
            displayState: 'sending',
            receivedCount: 0,
          }),
          partOf(2, '2026-11-13', 100, {
            displayState: 'scheduled',
            receivedCount: 0,
          }),
          partOf(3, '2026-11-14', 96, {
            displayState: 'scheduled',
            receivedCount: 0,
          }),
        ],
      }),
      {justSent: true}
    )

    const status = screen.getAllByRole('status')[0]
    expect(status).toHaveTextContent(
      'Campagne lancée. 100 membres la reçoivent aujourd’hui, la suite part seule les 13 et 14 novembre. Suivez-la ci-dessous.'
    )
    expect(status.querySelector('svg')).not.toBeNull()
  })

  it('Résumé : « Lancée le » et la paire Plafond, seule nouvelle', () => {
    renderDetail(campaignOf('a'))

    const summary = card('Résumé')
    expect(summary).toHaveTextContent('Lancée le12/11/2026 à 14:32')
    expect(summary).toHaveTextContent('Plafond100 envois par jour')
    expect(summary).toHaveTextContent('Marie Delorme')
    expect(summary).toHaveTextContent('Convocation à l’AG')
  })

  it('montre le contenu envoyé avec les variables non remplacées', () => {
    renderDetail()

    expect(screen.getByText(/Bonjour \{nom\}/)).toBeInTheDocument()
    expect(
      screen.getByText('{parcelle}', {selector: 'strong'})
    ).toBeInTheDocument()
  })
})

describe('CampaignDetail — carte Destinataires', () => {
  const page = recipientsPageOf(
    [
      recipientOf('r1', {name: 'Anne Arnaud'}),
      recipientOf('r2', {
        name: 'Bernard Barbier',
        status: 'pending',
        sentAt: null,
        scheduledFor: '2026-11-14',
      }),
      recipientOf('r3', {
        name: 'Camille Carron',
        status: 'to_verify',
        sentAt: null,
      }),
      recipientOf('r4', {name: 'Denis Dumas', status: 'failed', sentAt: null}),
      recipientOf('r5', {
        name: 'Élise Estève',
        status: 'unsubscribed',
        sentAt: null,
      }),
      recipientOf('r6', {name: null}),
    ],
    {total: 296, totalPages: 12}
  )

  const table = () => within(card('Destinataires')).getByRole('table')

  it('chaque état a son mot, sur la composition du design ; jamais la couleur seule', () => {
    renderDetail(spreadCampaignOf('a'), {recipients: page})

    const rows = within(table()).getAllByRole('row').slice(1)
    const cells = rows.map((row) => within(row).getAllByRole('cell')[2])
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'Reçuele 12/11/2026',
      'Programmée pour le 14/11',
      'À vérifier',
      'En échec',
      'Désinscrit',
      'Reçuele 12/11/2026',
    ])
    const badgeIn = (cell: HTMLElement) =>
      cell.querySelector('[data-slot="badge"]') as HTMLElement
    expect(badgeIn(cells[0])).not.toHaveClass('bg-secondary')
    expect(badgeIn(cells[0])).toHaveClass('text-muted-foreground')
    expect(within(cells[0]).getByText('le 12/11/2026')).toHaveClass('font-mono')
    expect(badgeIn(cells[1])).toHaveClass('bg-secondary')
    expect(badgeIn(cells[2]).querySelector('.bg-primary')).not.toBeNull()
    expect(badgeIn(cells[3])).toHaveClass('bg-destructive')
    expect(badgeIn(cells[4])).toHaveClass('text-muted-foreground')
  })

  it('une fiche supprimée apparaît avec un libellé de repli, parcelles en données', () => {
    renderDetail(spreadCampaignOf('a'), {recipients: page})

    const rows = within(table()).getAllByRole('row').slice(1)
    expect(within(rows[5]).getAllByRole('cell')[0]).toHaveTextContent(
      'Fiche supprimée'
    )
    expect(within(rows[0]).getByText('A-0102')).toHaveClass('font-mono')
  })

  it('« Afficher » porte le décompte de chaque option, et un résumé annoncé', async () => {
    renderDetail(spreadCampaignOf('a'), {recipients: page})

    const summary = within(card('Destinataires')).getByText(
      '296 destinataires — tous'
    )
    expect(summary).toHaveAttribute('aria-live', 'polite')
    await userEvent.click(screen.getByRole('combobox', {name: 'Afficher'}))
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual([
      'Tous (296)',
      'Reçue (200)',
      'Programmée (96)',
      'À vérifier (0)',
      'En échec (0)',
    ])
  })

  it('changer de filtre revient à la page 1', async () => {
    renderDetail(spreadCampaignOf('a'), {
      recipients: {...page, page: 3},
    })

    await userEvent.click(screen.getByRole('combobox', {name: 'Afficher'}))
    await userEvent.click(screen.getByRole('option', {name: 'Programmée (96)'}))

    expect(router.push).toHaveBeenCalledWith(
      '/bureau/campagnes/a?statut=programmee'
    )
  })

  it('« Précédent » est inactif et annoncé en page 1, « Suivant » mène à la page 2 du filtre', () => {
    renderDetail(spreadCampaignOf('a'), {
      recipients: {...page, filter: 'received', total: 200, totalPages: 8},
    })

    const nav = within(card('Destinataires')).getByRole('navigation')
    expect(
      within(nav).getByRole('button', {name: 'Précédent'})
    ).toHaveAttribute('aria-disabled', 'true')
    expect(within(nav).getByRole('link', {name: 'Suivant'})).toHaveAttribute(
      'href',
      '/bureau/campagnes/a?statut=recue&page=2'
    )
    expect(nav).toHaveTextContent('Page 1 sur 8')
  })

  it('g · liste vide pour « À vérifier » : la phrase le dit', () => {
    renderDetail(campaignOf('a'), {
      recipients: recipientsPageOf([], {filter: 'to_verify'}),
    })

    expect(card('Destinataires')).toHaveTextContent(
      'Aucun destinataire à vérifier.'
    )
    expect(within(card('Destinataires')).queryByRole('table')).toBeNull()
  })

  it('le jeton de désinscription n’est jamais dans le HTML', () => {
    const {container} = renderDetail(spreadCampaignOf('a'), {recipients: page})

    expect(container.innerHTML).not.toMatch(/token|desinscription/i)
  })
})

describe('CampaignNotFound — écran 2, état f', () => {
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

describe('CampaignDetailSkeleton — écran 2, état e', () => {
  it('rend des skeletons', () => {
    const {container} = render(<CampaignDetailSkeleton />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})
