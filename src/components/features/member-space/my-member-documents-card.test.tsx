import {describe, expect, it} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {MyMemberDocumentDTO} from '@/services/types/domain/member-document-types'

import {MyMemberDocumentsCard} from './my-member-documents-card'

const documentOf = (
  overrides: Partial<MyMemberDocumentDTO> = {}
): MyMemberDocumentDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Facture 2026',
  categoryName: 'Facture',
  documentDate: '2026-03-15',
  fileBytes: 310 * 1024,
  parcelNumbers: ['12', '13'],
  meterNumber: '0045821',
  holderName: null,
  ...overrides,
})

describe('MyMemberDocumentsCard — « Mes documents » (design s32, écran 1)', () => {
  it('1a : une seule liste pour toutes les fiches, chaque ligne avec son terrain', () => {
    render(
      <MyMemberDocumentsCard
        landCount={3}
        documents={[
          documentOf(),
          documentOf({
            id: '55555555-5555-4555-8555-555555555555',
            title: 'Facture 2026',
            parcelNumbers: ['31'],
            meterNumber: null,
            holderName: 'SCI Les Pins',
          }),
        ]}
      />
    )

    const card = screen.getByRole('region', {name: 'Mes documents'})
    expect(card).toHaveTextContent(
      'Vos documents personnels déposés par le bureau, pour vos 3 terrains. Vous seul les voyez.'
    )
    const lines = within(card).getAllByRole('listitem')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveTextContent(
      'Facture · Daté du 15/03/2026 · PDF · 310 Ko'
    )
    expect(lines[0]).toHaveTextContent(
      'Terrain : Parcelles 12 et 13 · Compteur 0045821'
    )
    expect(lines[1]).toHaveTextContent('Terrain : Parcelle 31')
    expect(lines[1]).toHaveTextContent('Au nom de SCI Les Pins')
  })

  it('télécharge par la route authentifiée, avec un nom accessible qui distingue le terrain', () => {
    const {container} = render(
      <MyMemberDocumentsCard
        landCount={2}
        documents={[documentOf({parcelNumbers: ['31'], meterNumber: null})]}
      />
    )

    expect(
      screen.getByRole('link', {
        name: 'Télécharger « Facture 2026 », parcelle 31 (PDF, 310 Ko)',
      })
    ).toHaveAttribute(
      'href',
      '/api/member-documents/33333333-3333-4333-8333-333333333333'
    )
    expect(container.innerHTML).not.toContain('/api/files')
  })

  it('un seul terrain : la phrase sans décompte, le terrain reste écrit', () => {
    render(<MyMemberDocumentsCard landCount={1} documents={[documentOf()]} />)

    expect(
      screen.getByText(
        'Vos documents personnels déposés par le bureau. Vous seul les voyez.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Terrain :/)).toBeInTheDocument()
  })

  it('1b : vide, avec de quoi écrire au bureau', () => {
    render(<MyMemberDocumentsCard landCount={1} documents={[]} />)

    expect(
      screen.getByText(
        'Aucun document personnel pour l’instant. Ils apparaîtront ici dès leur dépôt par le bureau.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Contact'})).toHaveAttribute(
      'href',
      '/contact'
    )
  })

  it('au-delà de 25 documents, la liste se pagine', async () => {
    const user = userEvent.setup()
    const many = Array.from({length: 27}, (_, index) =>
      documentOf({
        id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
        title: `Document ${index + 1}`,
      })
    )
    render(<MyMemberDocumentsCard landCount={1} documents={many} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(25)
    await user.click(screen.getByRole('button', {name: 'Suivant'}))

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Page 2 sur 2')).toBeInTheDocument()
  })
})
