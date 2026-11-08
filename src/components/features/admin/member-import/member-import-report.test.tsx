import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  ImportRejectionDTO,
  ImportReportDTO,
} from '@/services/types/domain/member-import-types'

import {MemberImportReport} from './member-import-report'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const report = (overrides: Partial<ImportReportDTO> = {}): ImportReportDTO => ({
  linesRead: 6,
  membersCreated: 3,
  accountsOpened: 2,
  mailOnlyMembers: 1,
  parcelsAttached: 4,
  linesRejected: 2,
  alreadyPresent: 0,
  rejections: [
    {line: 5, client: 'Sans Contact', reason: 'no_contact'},
    {line: 6, client: '', reason: 'missing_name'},
  ],
  remarks: [{line: 2, client: 'Lucie Fictive', remark: 'several_emails'}],
  ...overrides,
})

const renderReport = (value: ImportReportDTO) => {
  const onImportAnother = vi.fn()
  render(
    <MemberImportReport
      report={value}
      fileName="proprietaires-fictifs.csv"
      organizationId={ORG_ID}
      organizationName="Rives Vertes"
      importedAt="2026-11-08T13:32:00.000Z"
      onImportAnother={onImportAnother}
    />
  )
  return {onImportAnother}
}

const rejectionsTable = () =>
  screen.getByRole('table', {name: 'Lignes rejetées'})

describe('MemberImportReport — écran 2', () => {
  it('2a : bilan, rejets et remarques', () => {
    renderReport(report())

    expect(screen.getByRole('status')).toHaveTextContent(
      'Import terminé. 3 membres créés, 2 lignes à relire.'
    )
    expect(screen.getByText('Comptes de connexion ouverts')).toBeInTheDocument()
    const rows = within(rejectionsTable()).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent(
      'Ni adresse postale ni email : personne ne pourrait la joindre.'
    )
    expect(rows[1]).toHaveTextContent('(sans nom)')
    expect(rows[1]).toHaveTextContent('Le nom est manquant.')
    expect(
      within(
        screen.getByRole('table', {name: 'Lignes importées avec une remarque'})
      ).getByText('Plusieurs adresses email : seule la première a été gardée.')
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/Ce rapport contient des données personnelles/)
    ).not.toHaveLength(0)
  })

  it('2b : sans rejet', () => {
    renderReport(report({linesRejected: 0, rejections: []}))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Import terminé. Aucune ligne n’a été rejetée.'
    )
    expect(screen.getByText('Aucune ligne rejetée.')).toBeInTheDocument()
  })

  it('2c : relance du même fichier, rien de nouveau', () => {
    renderReport(
      report({
        membersCreated: 0,
        accountsOpened: 0,
        mailOnlyMembers: 0,
        parcelsAttached: 0,
        alreadyPresent: 3,
      })
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Rien de nouveau : ce fichier avait déjà été importé.'
    )
    expect(
      screen.getByText('Déjà présents : 3 membres, inchangés.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Lignes importées avec une remarque')).toBeNull()
  })

  it('2d : tout rejeté, alerte destructive', () => {
    renderReport(
      report({
        linesRead: 2,
        membersCreated: 0,
        accountsOpened: 0,
        mailOnlyMembers: 0,
        parcelsAttached: 0,
        remarks: [],
      })
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Aucun membre n’a été créé. Toutes les lignes ont été rejetées.'
    )
    expect(
      screen.getByText('Aucune ligne n’a été importée.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('pagine les rejets à 25 par ligne de tableau', async () => {
    const rejections: ImportRejectionDTO[] = Array.from(
      {length: 30},
      (_, index) => ({
        line: index + 2,
        client: `Membre ${index + 2}`,
        reason: 'no_contact',
      })
    )
    renderReport(report({linesRejected: 30, rejections}))

    expect(within(rejectionsTable()).getAllByRole('row')).toHaveLength(26)
    expect(screen.getByText('1 à 25 sur 30')).toBeInTheDocument()

    const [next] = screen.getAllByRole('button', {name: 'Suivant'})
    await userEvent.click(next)

    expect(within(rejectionsTable()).getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('26 à 30 sur 30')).toBeInTheDocument()
  })

  it('renvoie à l’association et propose d’importer un autre fichier', async () => {
    const {onImportAnother} = renderReport(report())

    expect(
      screen.getByRole('link', {name: 'Retour à l’association'})
    ).toHaveAttribute('href', `/admin/organizations/${ORG_ID}/edit`)
    await userEvent.click(
      screen.getByRole('button', {name: 'Importer un autre fichier'})
    )
    expect(onImportAnother).toHaveBeenCalled()
  })
})
