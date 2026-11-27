import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'

import {AnnualImportScreen} from './annual-import-screen'
import type {MemberAnnualImportFormState} from './annual-import-state'

const SUCCESS: MemberAnnualImportFormState = {
  success: true,
  fileName: 'clients-pennylane-2026.csv',
  importedAt: '2026-11-26T10:00:00.000Z',
  report: {
    linesRead: 1,
    profilesUpdated: 1,
    profilesUnchanged: 0,
    membersToCreate: 0,
    linesRejected: 0,
    updated: [],
    kept: [],
    replaced: [],
    designated: [],
    disabled: [],
    manual: [],
    toCreate: [],
    rejections: [],
  },
}

describe('AnnualImportScreen — du dépôt au rapport', () => {
  it('affiche le rapport après la mise à jour, puis revient au formulaire', async () => {
    const importAction = vi.fn(async () => SUCCESS)
    render(
      <AnnualImportScreen
        associationName="Rives Vertes"
        importAction={importAction}
      />
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Mettre à jour les coordonnées',
      })
    ).toBeInTheDocument()
    await userEvent.upload(
      screen.getByLabelText('Fichier clients de Pennylane'),
      new File(['a;b\n'], 'clients-pennylane-2026.csv', {type: 'text/csv'})
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Mettre à jour les fiches'})
    )

    expect(
      await screen.findByRole('heading', {name: 'Rapport de mise à jour'})
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {name: 'Importer un autre fichier'})
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Mettre à jour les coordonnées',
      })
    ).toBeInTheDocument()
  })
})
