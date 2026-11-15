import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  MemberQuestionDTO,
  MemberQuestionListPageDTO,
} from '@/services/types/domain/member-question-types'

import {
  MemberQuestionList,
  MemberQuestionListSkeleton,
} from './member-question-list'

const questionOf = (
  overrides: Partial<MemberQuestionDTO> = {}
): MemberQuestionDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  memberId: '66666666-6666-4666-8666-666666666666',
  memberName: 'Lucie Moreau',
  memberEmail: 'lucie.moreau@exemple.fr',
  categoryName: 'Voirie et portails',
  categoryDeleted: false,
  body: 'Bonjour, le portail du chemin des Crêtes ne se ferme plus depuis lundi.',
  notificationFailed: false,
  createdAt: new Date('2026-11-14T08:42:00Z'),
  ...overrides,
})

const listOf = (
  overrides: Partial<MemberQuestionListPageDTO> = {}
): MemberQuestionListPageDTO => ({
  items: [questionOf()],
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
  hasOpenCategories: true,
  ...overrides,
})

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('MemberQuestionList — C1, la file du bureau (s23)', () => {
  it('titre la page et mène aux sujets', () => {
    render(<MemberQuestionList list={listOf()} />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Questions des membres'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer les sujets'})
    ).toHaveAttribute('href', '/bureau/questions/sujets')
  })

  it('montre la date, l’identité du membre, le sujet et un extrait (critère 4)', () => {
    render(<MemberQuestionList list={listOf()} />)

    const [row] = tableRows()
    expect(row).toHaveTextContent('14/11/2026')
    expect(row).toHaveTextContent('Lucie Moreau')
    expect(row).toHaveTextContent('lucie.moreau@exemple.fr')
    expect(row).toHaveTextContent('Voirie et portails')
    expect(row).toHaveTextContent('le portail du chemin des Crêtes')
    expect(within(row).getByRole('link', {name: /Lire/})).toHaveAttribute(
      'href',
      '/bureau/questions/33333333-3333-4333-8333-333333333333'
    )
  })

  it('dit « catégorie supprimée » après le nom d’un sujet supprimé (critère 5)', () => {
    render(
      <MemberQuestionList
        list={listOf({items: [questionOf({categoryDeleted: true})]})}
      />
    )

    const [row] = tableRows()
    expect(row).toHaveTextContent('Voirie et portails — catégorie supprimée')
  })

  it('signale un échec de notification par un badge destructive', () => {
    render(
      <MemberQuestionList
        list={listOf({items: [questionOf({notificationFailed: true})]})}
      />
    )

    const [row] = tableRows()
    const badge = within(row).getByText('Notification non envoyée')
    expect(badge).toHaveAttribute('data-slot', 'badge')
    expect(badge).toHaveClass('bg-destructive')
  })

  it('dit « Sans adresse email » pour un membre qui n’en a pas', () => {
    render(
      <MemberQuestionList
        list={listOf({items: [questionOf({memberEmail: null})]})}
      />
    )

    expect(tableRows()[0]).toHaveTextContent('Sans adresse email')
  })

  it('passe en cartes empilées sous 640 px, le membre en titre', () => {
    render(<MemberQuestionList list={listOf()} />)

    const [card] = screen.getAllByTestId('member-question-card')
    expect(within(card).getByRole('heading', {level: 2})).toHaveTextContent(
      'Lucie Moreau'
    )
    expect(
      within(card).getByRole('link', {name: 'Lire la question'})
    ).toBeInTheDocument()
  })

  it('pagine : « Précédent » inactif en page 1, « Suivant » vers la page 2', () => {
    render(<MemberQuestionList list={listOf({total: 30, totalPages: 2})} />)

    const pagination = screen.getByRole('navigation')
    expect(
      within(pagination).getByRole('button', {name: 'Précédent'})
    ).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(pagination).getByRole('link', {name: 'Suivant'})
    ).toHaveAttribute('href', '/bureau/questions?page=2')
    expect(pagination).toHaveTextContent('Page 1 sur 2')
  })
})

describe('MemberQuestionList — C3, vide', () => {
  it('sans question, le dit', () => {
    render(<MemberQuestionList list={listOf({items: [], total: 0})} />)

    expect(
      screen.getByText('Aucune question reçue pour l’instant.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('link', {name: 'Créer les sujets'})).toBeNull()
  })

  it('sans aucun sujet, dit que les membres ne peuvent pas en poser et mène aux sujets', () => {
    render(
      <MemberQuestionList
        list={listOf({items: [], total: 0, hasOpenCategories: false})}
      />
    )

    expect(
      screen.getByText(
        'Aucune question reçue pour l’instant. Les membres ne peuvent pas encore en poser : aucun sujet n’est ouvert.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Créer les sujets'})
    ).toHaveAttribute('href', '/bureau/questions/sujets')
  })

  it('charge avec l’en-tête du tableau en place', () => {
    render(<MemberQuestionListSkeleton />)

    expect(
      screen.getByRole('columnheader', {name: 'Reçue le'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {name: 'Membre'})
    ).toBeInTheDocument()
  })
})
