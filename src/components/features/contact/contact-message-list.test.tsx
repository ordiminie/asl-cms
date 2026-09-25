import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  ContactMessageDTO,
  ContactMessageListPageDTO,
} from '@/services/types/domain/contact-message-types'

import {
  ContactMessageList,
  ContactMessageListSkeleton,
} from './contact-message-list'

const message = (
  id: string,
  overrides: Partial<ContactMessageDTO> = {}
): ContactMessageDTO => ({
  id,
  organizationId: '22222222-2222-4222-8222-222222222222',
  senderName: `Expéditeur ${id}`,
  senderEmail: `${id}@example.fr`,
  subject: `Objet ${id}`,
  body: 'Bonjour',
  read: false,
  notificationFailed: false,
  createdAt: new Date('2026-09-02T12:32:00Z'),
  ...overrides,
})

const listOf = (
  items: ContactMessageDTO[],
  overrides: Partial<ContactMessageListPageDTO> = {}
): ContactMessageListPageDTO => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  unreadCount: items.filter((item) => !item.read).length,
  ...overrides,
})

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('ContactMessageList — écran 2 du design s08', () => {
  it('titre la page et compte les non lus, sans bouton de création', () => {
    render(
      <ContactMessageList
        list={listOf([message('a'), message('b'), message('c', {read: true})])}
      />
    )

    expect(
      screen.getByRole('heading', {level: 1, name: 'Messages reçus'})
    ).toBeInTheDocument()
    expect(screen.getByText('2 messages non lus')).toBeInTheDocument()
    expect(
      screen
        .queryAllByRole('button')
        .filter((button) => !button.hasAttribute('disabled'))
    ).toHaveLength(0)
  })

  it('rend les messages dans l’ordre reçu, le plus récent d’abord', () => {
    render(
      <ContactMessageList
        list={listOf([
          message('recent'),
          message('ancien'),
          message('premier'),
        ])}
      />
    )

    expect(
      tableRows().map((row) => within(row).getAllByRole('cell')[0].textContent)
    ).toEqual(['Objet recent', 'Objet ancien', 'Objet premier'])
  })

  it('écrit la date de réception au format du tableau', () => {
    render(<ContactMessageList list={listOf([message('a')])} />)

    const [row] = tableRows()
    const cell = within(row).getByText('02/09/2026')
    expect(cell).toHaveClass('font-mono', 'tabular-nums')
  })

  it('donne le nom puis l’adresse, ou l’adresse seule sans nom', () => {
    render(
      <ContactMessageList
        list={listOf([message('a'), message('b', {senderName: null})])}
      />
    )

    const [named, anonymous] = tableRows()
    const namedFrom = within(named).getAllByRole('cell')[1]
    expect(namedFrom).toHaveTextContent('Expéditeur a')
    expect(namedFrom).toHaveTextContent('a@example.fr')
    expect(within(anonymous).getAllByRole('cell')[1].textContent).toBe(
      'b@example.fr'
    )
  })

  it('pose les deux badges sur une même ligne quand la notification a échoué', () => {
    render(
      <ContactMessageList
        list={listOf([message('a', {notificationFailed: true})])}
      />
    )

    const [row] = tableRows()
    const unread = within(row).getByText('Non lu')
    const failed = within(row).getByText('Notification non envoyée')
    const line = unread.closest('[data-slot="badge"]')?.parentElement
    expect(line).toBe(failed.closest('[data-slot="badge"]')?.parentElement)
    expect(line).toHaveClass('flex', 'flex-wrap', 'gap-2')
  })

  it('écrit l’état lu, et n’affiche le badge d’échec que s’il y a lieu', () => {
    render(<ContactMessageList list={listOf([message('a', {read: true})])} />)

    const [row] = tableRows()
    expect(within(row).getByText('Lu')).toBeInTheDocument()
    expect(within(row).queryByText('Notification non envoyée')).toBeNull()
  })

  it('une seule action écrite par ligne, vers le détail du message', () => {
    render(<ContactMessageList list={listOf([message('a'), message('b')])} />)

    for (const [index, row] of tableRows().entries()) {
      const links = within(row).getAllByRole('link')
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveTextContent('Ouvrir le message')
      expect(links[0]).toHaveAttribute(
        'href',
        `/bureau/messages/${index === 0 ? 'a' : 'b'}`
      )
    }
  })

  it('n’annonce pas de tri par colonne', () => {
    render(<ContactMessageList list={listOf([message('a')])} />)

    expect(document.querySelector('[aria-sort]')).toBeNull()
  })

  it('pagine par des liens écrits', () => {
    render(
      <ContactMessageList
        list={listOf([message('a')], {page: 2, totalPages: 3, total: 60})}
      />
    )

    expect(screen.getByText('Page 2 sur 3')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '← Précédent'})).toHaveAttribute(
      'href',
      '/bureau/messages?page=1'
    )
    expect(screen.getByRole('link', {name: 'Suivant →'})).toHaveAttribute(
      'href',
      '/bureau/messages?page=3'
    )
  })

  it('dit ce qui manque et mène à la page Contact quand la liste est vide', () => {
    render(<ContactMessageList list={listOf([])} />)

    expect(
      screen.getByText(
        'Aucun message pour l’instant. Les messages envoyés depuis la page Contact du site apparaissent ici.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Voir la page Contact du site'})
    ).toHaveAttribute('href', '/contact')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('empile les messages en cartes, paires dans l’ordre des colonnes', () => {
    render(<ContactMessageList list={listOf([message('a')])} />)

    const [card] = screen.getAllByTestId('contact-message-card')
    expect(
      within(card).getByRole('heading', {name: 'Objet a'})
    ).toBeInTheDocument()
    const terms = within(card)
      .getAllByRole('term')
      .map((term) => term.textContent)
    expect(terms).toEqual(['De', 'Reçu le'])
    expect(within(card).getByText('Non lu')).toBeInTheDocument()
    expect(
      within(card).getByRole('link', {name: 'Ouvrir le message'})
    ).toBeInTheDocument()
  })

  it('tient les planchers typographiques §1.3 : 17 px pour le texte, 15 px pour l’adresse', () => {
    render(<ContactMessageList list={listOf([message('a')])} />)

    const [row] = tableRows()
    const [subject, from] = within(row).getAllByRole('cell')
    expect(subject).toHaveClass('text-[17px]')
    expect(within(from).getByText('a@example.fr')).toHaveClass('text-[15px]')

    const [card] = screen.getAllByTestId('contact-message-card')
    expect(card.querySelector('dl')).toHaveClass('text-[17px]')
  })

  it('charge avec l’en-tête du tableau déjà en place et des lignes en skeleton', () => {
    render(<ContactMessageListSkeleton />)

    const table = screen.getByRole('table')
    expect(table.closest('[data-slot="card"]')).not.toBeNull()
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['Objet', 'De', 'Reçu le', 'État', 'Action'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThanOrEqual(3)
    for (const row of rows) {
      expect(row.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    }
  })
})
