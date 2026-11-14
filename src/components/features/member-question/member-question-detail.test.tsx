import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'
import type {MemberQuestionDTO} from '@/services/types/domain/member-question-types'

import {MemberQuestionDetail} from './member-question-detail'

const QUESTION: MemberQuestionDTO = {
  id: '33333333-3333-4333-8333-333333333333',
  memberId: '66666666-6666-4666-8666-666666666666',
  memberName: 'Lucie Moreau',
  memberEmail: 'lucie.moreau@exemple.fr',
  categoryName: 'Voirie et portails',
  categoryDeleted: false,
  body: 'Bonjour,\nle portail ne se ferme plus.\nMerci, Lucie',
  notificationFailed: false,
  createdAt: new Date('2026-11-14T08:42:00Z'),
}

describe('MemberQuestionDetail — C2 (s23)', () => {
  it('ramène à la file et titre la question du nom du membre', () => {
    render(<MemberQuestionDetail question={QUESTION} />)

    expect(
      screen.getByRole('link', {name: 'Revenir aux questions'})
    ).toHaveAttribute('href', '/bureau/questions')
    expect(
      screen.getByRole('heading', {level: 1, name: 'Question de Lucie Moreau'})
    ).toBeInTheDocument()
  })

  it('donne le membre (fiche et mailto:), le sujet et la date (critère 4)', () => {
    render(<MemberQuestionDetail question={QUESTION} />)

    expect(screen.getByRole('link', {name: 'Lucie Moreau'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires/66666666-6666-4666-8666-666666666666'
    )
    expect(
      screen.getByRole('link', {name: 'lucie.moreau@exemple.fr'})
    ).toHaveAttribute('href', 'mailto:lucie.moreau@exemple.fr')
    expect(screen.getByText('Voirie et portails')).toBeInTheDocument()
    expect(screen.getByText('14/11/2026 09:42')).toBeInTheDocument()
  })

  it('donne le texte entier, retours à la ligne compris', () => {
    render(<MemberQuestionDetail question={QUESTION} />)

    const body = screen.getByTestId('member-question-body')
    expect(body.textContent).toBe(QUESTION.body)
    expect(body).toHaveClass('whitespace-pre-line')
  })

  it('un seul bouton default « Répondre par email » en mailto:', () => {
    render(<MemberQuestionDetail question={QUESTION} />)

    const reply = screen.getByRole('link', {name: 'Répondre par email'})
    expect(reply).toHaveAttribute('href', 'mailto:lucie.moreau@exemple.fr')
    expect(reply).toHaveClass('bg-primary')
  })

  it('sans adresse email du membre, ni mailto: ni bouton de réponse', () => {
    render(<MemberQuestionDetail question={{...QUESTION, memberEmail: null}} />)

    expect(screen.getByText('Sans adresse email')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'Répondre par email'})).toBeNull()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('dit « catégorie supprimée » et l’échec de notification', () => {
    render(
      <MemberQuestionDetail
        question={{
          ...QUESTION,
          categoryDeleted: true,
          notificationFailed: true,
        }}
      />
    )

    expect(screen.getByText(/catégorie supprimée/)).toBeInTheDocument()
    expect(screen.getByText('Notification non envoyée')).toHaveClass(
      'bg-destructive'
    )
  })
})
