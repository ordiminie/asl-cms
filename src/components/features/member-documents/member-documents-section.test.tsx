import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {BureauMemberDocumentDTO} from '@/services/types/domain/member-document-types'

import {MemberDocumentsCard} from './member-documents-section'

const PROFILE_ID = 'a1200000-0000-4000-8000-000000000008'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_ID = '55555555-5555-4555-8555-555555555555'

const documentOf = (
  overrides: Partial<BureauMemberDocumentDTO> = {}
): BureauMemberDocumentDTO => ({
  id: DOCUMENT_ID,
  title: 'Facture 2026',
  categoryId: '44444444-4444-4444-8444-444444444444',
  categoryName: 'Facture',
  documentDate: '2026-03-15',
  fileBytes: 310 * 1024,
  createdAt: new Date('2026-03-16T10:00:00Z'),
  memberProfileId: PROFILE_ID,
  memberProfileName: 'Bernard Lefèvre',
  ...overrides,
})

const removeAction = vi.fn()

const renderCard = (
  documents: BureauMemberDocumentDTO[],
  options: Partial<Parameters<typeof MemberDocumentsCard>[0]> = {}
) =>
  render(
    <MemberDocumentsCard
      memberProfileId={PROFILE_ID}
      memberName="Bernard Lefèvre"
      hasAccount
      documents={documents}
      removeAction={removeAction}
      {...options}
    />
  )

beforeEach(() => {
  vi.clearAllMocks()
  removeAction.mockResolvedValue({status: 'idle'})
})

describe('MemberDocumentsCard — section « Documents » de la fiche (design s32, écran 2)', () => {
  it('2a : titre, phrase de visibilité, dépôt en outline et une ligne par document', () => {
    renderCard([
      documentOf(),
      documentOf({
        id: OTHER_ID,
        title: 'Convocation AG 2026',
        categoryName: 'Convocation',
        documentDate: '2026-05-02',
        fileBytes: 120 * 1024,
      }),
    ])

    expect(
      screen.getByRole('heading', {level: 2, name: 'Documents'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Visibles des comptes reliés à cette fiche, dans leur espace. Aucun autre membre ne les voit.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Déposer un document'})
    ).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}/documents/nouveau`
    )

    const table = screen.getByRole('table', {
      name: 'Documents de Bernard Lefèvre, les plus récents en premier',
    })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Facture 2026')
    expect(rows[0]).toHaveTextContent('Facture')
    expect(rows[0]).toHaveTextContent('15/03/2026')
    expect(rows[0]).toHaveTextContent('310 Ko')
    expect(
      within(rows[0]).getAllByRole('button', {name: /Retirer/})
    ).toHaveLength(1)
  })

  it('2a : le titre télécharge par la route authentifiée, jamais par un chemin de stockage', () => {
    const {container} = renderCard([documentOf()])

    expect(
      within(screen.getByRole('table')).getByRole('link', {
        name: 'Télécharger « Facture 2026 » (PDF, 310 Ko)',
      })
    ).toHaveAttribute('href', `/api/member-documents/${DOCUMENT_ID}`)
    expect(container.innerHTML).not.toContain('member-documents/a1')
    expect(container.innerHTML).not.toContain('/api/files')
  })

  it('2b : vide', () => {
    renderCard([])

    expect(
      screen.getByText('Aucun document pour cette fiche.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('2b : fiche sans compte relié, le dossier attend un compte', () => {
    renderCard([], {hasAccount: false})

    expect(
      screen.getByText(
        'Cette fiche n’est reliée à aucun compte : ses documents attendent dans son dossier qu’un compte y soit relié.'
      )
    ).toBeInTheDocument()
  })

  it('2e : succès du dépôt, avec le titre du document', () => {
    renderCard([documentOf()], {
      notice: {kind: 'deposited', documentId: DOCUMENT_ID},
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Document déposé. « Facture 2026 » est visible dès maintenant dans l’espace des comptes reliés à cette fiche, carte « Mes documents ».'
    )
  })

  it('2e : succès du retrait', () => {
    renderCard([], {notice: {kind: 'removed'}})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Document retiré. Il n’apparaît plus dans l’espace des comptes reliés à cette fiche et son adresse ne sert plus le fichier.'
    )
  })

  it('2f : le retrait passe par un alert-dialog qui nomme le document et la fiche', async () => {
    const user = userEvent.setup()
    renderCard([documentOf()])

    await user.click(
      within(screen.getByRole('table')).getByRole('button', {name: /Retirer/})
    )

    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent(
      'Retirer « Facture 2026 » du dossier de Bernard Lefèvre ?'
    )
    expect(removeAction).not.toHaveBeenCalled()

    await user.click(
      within(confirm).getByRole('button', {name: 'Retirer le document'})
    )

    expect(removeAction).toHaveBeenCalledWith(DOCUMENT_ID, 'profile')
  })

  it('2f : un échec du retrait est dit', async () => {
    removeAction.mockResolvedValue({status: 'error', message: 'Raté.'})
    const user = userEvent.setup()
    renderCard([documentOf()])

    await user.click(
      within(screen.getByRole('table')).getByRole('button', {name: /Retirer/})
    )
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Retirer le document',
      })
    )

    expect(await screen.findByText('Raté.')).toBeInTheDocument()
  })
})
