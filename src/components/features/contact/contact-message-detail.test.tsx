import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import type {ContactMessageDTO} from '@/services/types/domain/contact-message-types'

import {
  ContactMessageDetail,
  type ContactMessageReadActionResult,
} from './contact-message-detail'

const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

const message = (
  overrides: Partial<ContactMessageDTO> = {}
): ContactMessageDTO => ({
  id: MESSAGE_ID,
  organizationId: '22222222-2222-4222-8222-222222222222',
  senderName: 'Claire Meunier',
  senderEmail: 'claire.meunier@example.fr',
  subject: "Analyse d'eau du forage",
  body: 'Bonjour,\n\nQuand paraît la prochaine analyse ?\nMerci.',
  read: false,
  notificationFailed: false,
  createdAt: new Date('2026-09-02T12:32:00Z'),
  ...overrides,
})

const markUnreadAction =
  vi.fn<(id: string) => Promise<ContactMessageReadActionResult>>()

beforeEach(() => {
  vi.clearAllMocks()
  markUnreadAction.mockResolvedValue({status: 'saved'})
})

describe('ContactMessageDetail — écran 3 du design s08', () => {
  it('titre la page de l’objet et date la réception en clair', () => {
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    expect(
      screen.getByRole('heading', {level: 1, name: "Analyse d'eau du forage"})
    ).toBeInTheDocument()
    expect(
      screen.getByText('Reçu le 2 septembre 2026 à 14 h 32')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: '← Messages reçus'})
    ).toHaveAttribute('href', '/bureau/messages')
  })

  it('écrit l’expéditeur, et son adresse en mailto:', () => {
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    expect(screen.getByText('De : Claire Meunier')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'claire.meunier@example.fr'})
    ).toHaveAttribute('href', 'mailto:claire.meunier@example.fr')
  })

  it('écrit l’expéditeur en body-strong, 17 px (§1.3)', () => {
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    expect(screen.getByText('De : Claire Meunier')).toHaveClass(
      'text-[17px]',
      'font-semibold'
    )
  })

  it('écrit l’adresse de l’expéditeur au plancher du corps, 17 px (§1.3)', () => {
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    const mailto = screen.getByRole('link', {
      name: 'claire.meunier@example.fr',
    })
    expect(mailto).toHaveClass('text-[17px]')
    expect(mailto).not.toHaveClass('text-base')
  })

  it('dit que le nom manque quand le visiteur ne l’a pas donné', () => {
    render(
      <ContactMessageDetail
        message={message({senderName: null})}
        markUnreadAction={markUnreadAction}
      />
    )

    expect(screen.getByText('De : nom non renseigné')).toBeInTheDocument()
  })

  it('conserve les retours à la ligne du message, sans troncature', () => {
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    const body = screen.getByTestId('contact-message-body')
    expect(body.textContent).toBe(message().body)
    expect(body).toHaveClass('whitespace-pre-line')
    expect(body).not.toHaveClass('line-clamp-3', 'truncate')
  })

  it('n’affiche aucune alerte quand la notification est partie', () => {
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('signale l’échec de notification au-dessus de l’expéditeur, avec le lien vers Réglages', () => {
    render(
      <ContactMessageDetail
        message={message({notificationFailed: true})}
        markUnreadAction={markUnreadAction}
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Ce message est bien enregistré, mais l’email d’avertissement au bureau n’est pas parti. Rien n’est perdu : le message est là, et l’adresse de notification se vérifie dans Réglages.'
    )
    expect(
      screen.getByRole('link', {name: 'Ouvrir les Réglages'})
    ).toHaveAttribute('href', '/bureau/reglages')
    const sender = screen.getByText('De : Claire Meunier')
    expect(
      alert.compareDocumentPosition(sender) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('une seule action, « Marquer comme non lu », sans suppression ni archivage', async () => {
    const user = userEvent.setup()
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    expect(
      screen.getByText('Marqué comme lu à l’ouverture.')
    ).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)

    await user.click(screen.getByRole('button', {name: 'Marquer comme non lu'}))

    expect(markUnreadAction).toHaveBeenCalledWith(MESSAGE_ID)
    expect(await screen.findByText('Marqué comme non lu.')).toBeInTheDocument()
  })

  it('écrit le refus dans la page quand la bascule échoue', async () => {
    const user = userEvent.setup()
    markUnreadAction.mockResolvedValue({
      status: 'error',
      message: 'Seul le bureau peut consulter les messages.',
    })
    render(
      <ContactMessageDetail
        message={message()}
        markUnreadAction={markUnreadAction}
      />
    )

    await user.click(screen.getByRole('button', {name: 'Marquer comme non lu'}))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Seul le bureau peut consulter les messages.'
      )
    )
  })
})
