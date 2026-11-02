import {act} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/lib/helper/page-navigation.client', () => ({
  reloadPageAt: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {reloadPageAt} from '@/lib/helper/page-navigation.client'

import {IMPERSONATION_EXPIRED_URL, ImpersonationBar} from './impersonation-bar'

const NOW = new Date('2026-11-02T15:00:00.000Z')

const stopAction = vi.fn()

const renderBar = (secondsLeft: number) =>
  render(
    <ImpersonationBar
      subjectName="Claire Montel"
      roleLabel="Président(e)"
      organizationName="Rives Vertes"
      expiresAt={new Date(NOW.getTime() + secondsLeft * 1000).toISOString()}
      stopAction={stopAction}
    />
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({shouldAdvanceTime: true})
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ImpersonationBar (s48, écran 3)', () => {
  it('dit à la place de qui, avec rôle, association et heure de fin', () => {
    renderBar(30 * 60)

    const visibleTitle = screen
      .getAllByText('Vous agissez à la place de Claire Montel')
      .filter((node) => !node.closest('[aria-live]'))
    expect(visibleTitle).toHaveLength(1)
    expect(
      screen.getByText(/Président\(e\) · Rives Vertes · fin de la session à/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Revenir à mon compte'})
    ).toBeInTheDocument()
  })

  it('n’est jamais refermable : un seul bouton, la sortie', () => {
    renderBar(30 * 60)

    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('annonce l’entrée en assertif, juste après le montage', async () => {
    renderBar(30 * 60)

    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    const assertive = document.querySelector('[aria-live="assertive"]')
    expect(assertive).toHaveTextContent(
      'Vous agissez à la place de Claire Montel'
    )
  })

  it('compte à rebours dans les deux dernières minutes, annoncé poliment', async () => {
    renderBar(105)

    const polite = await screen.findByText(
      'La session se termine dans 1 min 45 s.'
    )
    expect(polite.closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('pas de compte à rebours avant les deux dernières minutes', () => {
    renderBar(5 * 60)

    expect(screen.queryByText(/La session se termine dans/)).toBeNull()
  })

  it('à l’expiration, recharge la page de connexion prestataire', async () => {
    renderBar(2)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(reloadPageAt).toHaveBeenCalledWith(IMPERSONATION_EXPIRED_URL)
    expect(IMPERSONATION_EXPIRED_URL).toBe(
      '/login/prestataire?session=terminee'
    )
  })

  it('« Revenir à mon compte » rend la session d’origine et recharge la page', async () => {
    vi.useRealTimers()
    stopAction.mockResolvedValue({
      success: true,
      url: '/admin/organizations/org/edit?retour=1',
    })
    renderBar(30 * 60)

    await act(async () => {
      screen.getByRole('button', {name: 'Revenir à mon compte'}).click()
    })

    expect(stopAction).toHaveBeenCalledTimes(1)
    expect(reloadPageAt).toHaveBeenCalledWith(
      '/admin/organizations/org/edit?retour=1'
    )
  })

  it('une sortie refusée affiche le message, sans recharger', async () => {
    vi.useRealTimers()
    stopAction.mockResolvedValue({success: false, message: 'Échec'})
    renderBar(30 * 60)

    await act(async () => {
      screen.getByRole('button', {name: 'Revenir à mon compte'}).click()
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Échec')
    expect(reloadPageAt).not.toHaveBeenCalled()
  })
})
