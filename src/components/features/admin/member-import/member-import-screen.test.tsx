import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'

import {MemberImportScreen} from './member-import-screen'
import type {MemberImportFormState} from './member-import-state'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const SUCCESS: MemberImportFormState = {
  success: true,
  fileName: 'proprietaires-fictifs.csv',
  organizationId: ORG_ID,
  importedAt: '2026-11-08T13:32:00.000Z',
  report: {
    linesRead: 1,
    membersCreated: 1,
    accountsOpened: 1,
    mailOnlyMembers: 0,
    parcelsAttached: 1,
    linesRejected: 0,
    alreadyPresent: 0,
    rejections: [],
    remarks: [],
  },
}

describe('MemberImportScreen — du formulaire au rapport', () => {
  it('affiche le rapport après l’import, puis revient au formulaire', async () => {
    const importAction = vi.fn(async () => SUCCESS)
    render(
      <MemberImportScreen
        organizations={[{id: ORG_ID, name: 'Rives Vertes'}]}
        initialOrganizationId={ORG_ID}
        importAction={importAction}
      />
    )

    await userEvent.upload(
      screen.getByLabelText('Fichier CSV des membres'),
      new File(['a;b\n'], 'proprietaires-fictifs.csv', {type: 'text/csv'})
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Importer les membres'})
    )

    expect(
      await screen.findByRole('heading', {name: 'Rapport d’import'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(/proprietaires-fictifs\.csv · Rives Vertes/)
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {name: 'Importer un autre fichier'})
    )

    expect(
      screen.getByRole('heading', {name: 'Importer des membres'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Importer les membres'})
    ).toBeDisabled()
  })
})
