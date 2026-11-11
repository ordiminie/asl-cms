import {Suspense} from 'react'
import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'
import type {MemberUnsubscribeDTO} from '@/services/types/domain/campaign-types'

import {MemberUnsubscribedMention} from './member-unsubscribed-mention'

/** Une promesse deja resolue : `use()` la lit sans suspendre. */
const resolved = (value: MemberUnsubscribeDTO | null) =>
  Object.assign(Promise.resolve(value), {status: 'fulfilled', value})

const renderMention = (value: MemberUnsubscribeDTO | null) =>
  render(
    <Suspense fallback={null}>
      <MemberUnsubscribedMention promise={resolved(value)} />
    </Suspense>
  )

describe('MemberUnsubscribedMention — écran 5 du design s25', () => {
  it('a · désinscrit : badge outline et phrase datée, heure de Paris', () => {
    renderMention({createdAt: '2026-11-11T23:30:00.000Z'})

    expect(
      screen.getByText('Désinscrit des campagnes', {
        selector: '[data-slot="badge"]',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'A refusé les campagnes email le 12/11/2026 (depuis le lien d’un email).'
      )
    ).toBeInTheDocument()
  })

  it('aucune action de levée', () => {
    renderMention({createdAt: '2026-11-12T13:32:00.000Z'})

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('b · non désinscrit : rien', () => {
    renderMention(null)

    expect(screen.queryByText('Désinscrit des campagnes')).toBeNull()
    expect(screen.queryByText(/A refusé les campagnes/)).toBeNull()
  })
})
