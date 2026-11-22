import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {BureauSharedDocumentDTO} from '@/services/types/domain/shared-document-types'

import {SharedDocumentList} from './shared-document-list'

const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_ID = '55555555-5555-4555-8555-555555555555'

const documentOf = (
  overrides: Partial<BureauSharedDocumentDTO> = {}
): BureauSharedDocumentDTO => ({
  id: DOCUMENT_ID,
  title: 'Ordre du jour de l’AG 2026',
  categoryId: '44444444-4444-4444-8444-444444444444',
  categoryName: 'Ordres du jour',
  fileBytes: 180 * 1024,
  createdAt: new Date('2026-05-02T10:00:00Z'),
  ...overrides,
})

const deleteAction = vi.fn()

const renderList = (
  documents: BureauSharedDocumentDTO[],
  notice?: Parameters<typeof SharedDocumentList>[0]['notice']
) =>
  render(
    <SharedDocumentList
      documents={documents}
      notice={notice}
      deleteAction={deleteAction}
    />
  )

beforeEach(() => {
  vi.clearAllMocks()
  deleteAction.mockResolvedValue({status: 'idle'})
})

describe('SharedDocumentList — écran 2 du design s31', () => {
  it('2a : titre, intro, barre (catégories + dépôt) et une ligne par document', () => {
    renderList([
      documentOf(),
      documentOf({
        id: OTHER_ID,
        title: 'Statuts de l’ASL',
        categoryName: 'Statuts',
        fileBytes: 620 * 1024,
        createdAt: new Date('2026-01-10T10:00:00Z'),
      }),
    ])

    expect(
      screen.getByRole('heading', {level: 1, name: 'Documents'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Les documents partagés avec tous les membres de l’association, dans leur espace.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer les catégories'})
    ).toHaveAttribute('href', '/bureau/documents/categories')
    expect(
      screen.getByRole('link', {name: 'Déposer un document'})
    ).toHaveAttribute('href', '/bureau/documents/nouveau')

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Ordre du jour de l’AG 2026')
    expect(rows[0]).toHaveTextContent('Ordres du jour')
    expect(rows[0]).toHaveTextContent('02/05/2026')
    expect(rows[0]).toHaveTextContent('180 Ko')
    expect(
      within(rows[0]).getAllByRole('button', {name: /Retirer/})
    ).toHaveLength(1)
  })

  it('2a : le titre télécharge par la route authentifiée, jamais par un chemin de stockage', () => {
    const {container} = renderList([documentOf()])

    expect(
      screen.getByRole('link', {
        name: 'Télécharger « Ordre du jour de l’AG 2026 » (PDF, 180 Ko)',
      })
    ).toHaveAttribute('href', `/api/documents/${DOCUMENT_ID}`)
    expect(container.innerHTML).not.toContain('shared-documents/')
    expect(container.innerHTML).not.toContain('/api/files')
  })

  it('2b : vide, avec l’action qui le comble', () => {
    renderList([])

    expect(
      screen.getByText(
        'Aucun document partagé. Déposez les statuts, un procès-verbal ou un ordre du jour : tous les membres le verront dans leur espace.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('2c : le retrait passe par un alert-dialog qui nomme l’acte', async () => {
    const user = userEvent.setup()
    renderList([documentOf()])

    await user.click(screen.getByRole('button', {name: /Retirer/}))

    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent(
      'Retirer « Ordre du jour de l’AG 2026 » ?'
    )
    expect(confirm).toHaveTextContent(
      'Il disparaît de l’espace des membres et son adresse cesse de servir le fichier.'
    )
    expect(deleteAction).not.toHaveBeenCalled()

    await user.click(
      within(confirm).getByRole('button', {name: 'Retirer le document'})
    )

    expect(deleteAction).toHaveBeenCalledWith(DOCUMENT_ID)
  })

  it('2c : un échec du retrait est dit, sans fermer la liste', async () => {
    deleteAction.mockResolvedValue({status: 'error', message: 'Raté.'})
    const user = userEvent.setup()
    renderList([documentOf()])

    await user.click(screen.getByRole('button', {name: /Retirer/}))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Retirer le document',
      })
    )

    expect(await screen.findByText('Raté.')).toBeInTheDocument()
  })

  it('2d : après un dépôt, l’alerte nomme le document déposé', () => {
    renderList([documentOf()], {kind: 'published', documentId: DOCUMENT_ID})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Document déposé. « Ordre du jour de l’AG 2026 » est visible dès maintenant dans l’espace des membres, carte « Documents de l’association ».'
    )
  })

  it('2d : après un retrait, l’alerte le confirme', () => {
    renderList([], {kind: 'deleted'})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Document retiré. Il n’apparaît plus dans l’espace des membres et son adresse ne sert plus le fichier.'
    )
  })
})
