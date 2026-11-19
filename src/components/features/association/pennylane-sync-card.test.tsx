import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
import type {BillingSyncOverviewDTO} from '@/services/types/domain/billing-sync-types'

import {PennylaneSyncCard} from './pennylane-sync-card'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const overview = (
  overrides: Partial<BillingSyncOverviewDTO> = {}
): BillingSyncOverviewDTO => ({
  lastAttemptAt: '2026-11-19T13:05:00.000Z',
  syncedAt: '2026-11-19T13:05:00.000Z',
  lastError: null,
  counts: {
    written: 412,
    draft: 3,
    creditNote: 1,
    noCustomer: 16,
    noDate: 2,
    notEur: 0,
    nonPositive: 0,
    unmatched: 2,
  },
  unmatchedCustomers: [
    {id: '5000', name: 'MARTIN Paul', reference: 'AH 9 - 0099'},
  ],
  terrainMismatches: [
    {
      invoiceNumber: 'F-2026-0412',
      memberProfileId: PROFILE_ID,
      memberProfileName: 'Bernard Lefèvre',
      parcels: ['AH 7'],
      meter: '0045821',
    },
  ],
  profilesWithoutId: [{id: PROFILE_ID, name: 'Hélène Roy'}],
  ...overrides,
})

const syncAction = vi.fn()

const renderCard = async (value: BillingSyncOverviewDTO) => {
  await act(async () => {
    render(<PennylaneSyncCard overview={value} syncAction={syncAction} />)
  })
}

const card = () =>
  screen
    .getByRole('heading', {level: 3, name: 'Synchronisation Pennylane'})
    .closest('[data-slot="card"]') as HTMLElement

beforeEach(() => {
  syncAction.mockReset()
})

describe('PennylaneSyncCard — carte « Synchronisation Pennylane » (s20, écran 3)', () => {
  it('3a : la dernière mise à jour, heure de Paris', async () => {
    await renderCard(overview())

    expect(card()).toHaveTextContent(
      'Factures mises à jour le 19/11/2026 à 14 h 05.'
    )
  })

  it('les comptes : remontées, et écartées par motif', async () => {
    await renderCard(overview())

    const counts = within(card()).getByRole('list', {name: 'Comptes'})
    expect(counts).toHaveTextContent('Factures remontées412')
    expect(counts).toHaveTextContent('Brouillons écartés3')
    expect(counts).toHaveTextContent('Avoirs écartés1')
    expect(counts).toHaveTextContent('Sans client16')
    expect(counts).toHaveTextContent('Sans date ou sans échéance2')
    expect(counts).toHaveTextContent('Clients Pennylane sans fiche2')
  })

  it('critère 3 : les fiches sans identifiant, avec un lien vers chacune', async () => {
    await renderCard(overview())

    expect(
      within(card()).getByRole('link', {name: 'Hélène Roy'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_ID}`)
  })

  it('critère 3 : les clients Pennylane sans fiche, référence et nom tels que Pennylane les écrit', async () => {
    await renderCard(overview())

    const list = within(card()).getByRole('list', {
      name: 'Clients Pennylane sans fiche',
    })
    expect(list).toHaveTextContent('AH 9 - 0099')
    expect(list).toHaveTextContent('MARTIN Paul')
  })

  it('les écarts de terrain : la facture, ce qu’elle écrit, et la fiche liée', async () => {
    await renderCard(overview())

    const list = within(card()).getByRole('list', {name: 'Écarts de terrain'})
    expect(list).toHaveTextContent(
      'La facture n° F-2026-0412 indique la parcelle AH 7 · compteur 0045821.'
    )
    expect(
      within(list).getByRole('link', {name: 'Bernard Lefèvre'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_ID}`)
  })

  it('3b : la dernière a échoué — avertissement, motif, données conservées', async () => {
    await renderCard(overview({lastError: 'unavailable'}))

    expect(card()).toHaveTextContent(
      'La dernière mise à jour n’a pas abouti. Pennylane n’a pas répondu. Les factures déjà connues restent affichées. Nouvel essai dans l’heure.'
    )
    expect(card()).toHaveTextContent('Factures remontées412')
  })

  it('clé absente : la phrase dit que la clé n’est pas configurée', async () => {
    await renderCard(overview({lastError: 'missing_key'}))

    expect(card()).toHaveTextContent(
      'La clé d’accès à Pennylane n’est pas configurée sur le serveur.'
    )
  })

  it('jamais synchronisé : la première a lieu dans l’heure', async () => {
    await renderCard(
      overview({
        lastAttemptAt: null,
        syncedAt: null,
        counts: null,
        unmatchedCustomers: [],
        terrainMismatches: [],
      })
    )

    expect(card()).toHaveTextContent(
      'Pas encore de mise à jour. La première a lieu dans l’heure.'
    )
    expect(within(card()).queryByRole('list', {name: 'Comptes'})).toBeNull()
  })

  it('« Mettre à jour maintenant » lance l’action, sans soumettre le formulaire des réglages', async () => {
    syncAction.mockResolvedValue({
      status: 'synced',
      message: 'Factures mises à jour.',
    })
    await renderCard(overview())

    const button = within(card()).getByRole('button', {
      name: 'Mettre à jour maintenant',
    })
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)

    expect(syncAction).toHaveBeenCalledOnce()
    expect(
      await within(card()).findByText('Factures mises à jour.')
    ).toBeInTheDocument()
  })
})
