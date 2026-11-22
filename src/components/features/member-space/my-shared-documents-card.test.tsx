import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {SharedDocumentDTO} from '@/services/types/domain/shared-document-types'

import {
  MySharedDocumentsCard,
  MySharedDocumentsCardLoading,
} from './my-shared-documents-card'

const documentOf = (
  overrides: Partial<SharedDocumentDTO> = {}
): SharedDocumentDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Statuts de l’ASL, version du 12 mars 2019',
  categoryName: 'Statuts',
  fileBytes: 620 * 1024,
  createdAt: new Date('2026-01-10T10:00:00Z'),
  ...overrides,
})

const DOCUMENTS: SharedDocumentDTO[] = [
  documentOf(),
  documentOf({
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Procès-verbal de l’AG du 14 juin 2025',
    categoryName: 'Procès-verbaux',
    fileBytes: Math.round(1.4 * 1024 * 1024),
    createdAt: new Date('2025-06-30T10:00:00Z'),
  }),
  documentOf({
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Ordre du jour de l’AG 2026',
    categoryName: 'Ordres du jour',
    fileBytes: 180 * 1024,
    createdAt: new Date('2026-05-02T10:00:00Z'),
  }),
  documentOf({
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Ordre du jour de l’AG 2025',
    categoryName: 'Ordres du jour',
    fileBytes: 150 * 1024,
    createdAt: new Date('2025-05-02T10:00:00Z'),
  }),
]

describe('MySharedDocumentsCard — écran 1 du design s31', () => {
  it('1a : titre, intro, groupes par catégorie dans l’ordre alphabétique', () => {
    render(<MySharedDocumentsCard documents={DOCUMENTS} />)

    const card = screen.getByRole('region', {
      name: 'Documents de l’association',
    })
    expect(card).toHaveTextContent(
      'Les statuts, procès-verbaux et ordres du jour publiés par le bureau.'
    )
    expect(
      within(card)
        .getAllByRole('heading', {level: 3})
        .map((heading) => heading.textContent)
    ).toEqual(['Ordres du jour', 'Procès-verbaux', 'Statuts'])
  })

  it('1a : dans une catégorie, du plus récent au plus ancien, avec date, format et poids', () => {
    render(<MySharedDocumentsCard documents={DOCUMENTS} />)

    const group = screen.getByRole('region', {name: 'Ordres du jour'})
    const items = within(group).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Ordre du jour de l’AG 2026')
    expect(items[0]).toHaveTextContent('Déposé le 02/05/2026 · PDF · 180 Ko')
    expect(items[1]).toHaveTextContent('Ordre du jour de l’AG 2025')
  })

  it('1a : une seule action par ligne, vers la route authentifiée par identifiant', () => {
    const {container} = render(<MySharedDocumentsCard documents={DOCUMENTS} />)

    const link = screen.getByRole('link', {
      name: 'Télécharger « Statuts de l’ASL, version du 12 mars 2019 » (PDF, 620 Ko)',
    })
    expect(link).toHaveAttribute(
      'href',
      '/api/documents/33333333-3333-4333-8333-333333333333'
    )
    const hrefs = Array.from(container.querySelectorAll('a')).map(
      (anchor) => anchor.getAttribute('href') ?? ''
    )
    expect(hrefs.some((href) => href.includes('shared-documents/'))).toBe(false)
    expect(hrefs.some((href) => href.startsWith('/api/files'))).toBe(false)
    expect(screen.getAllByRole('link', {name: /^Télécharger/})).toHaveLength(
      DOCUMENTS.length
    )
  })

  it('1a : le pied de carte renvoie au bureau par la page Contact', () => {
    render(<MySharedDocumentsCard documents={DOCUMENTS} />)

    expect(screen.getByRole('link', {name: 'Contact'})).toHaveAttribute(
      'href',
      '/contact'
    )
  })

  it('1b : vide, sans liste, avec l’invitation à écrire au bureau', () => {
    render(<MySharedDocumentsCard documents={[]} />)

    expect(
      screen.getByText(
        'Aucun document publié pour l’instant. Les statuts, procès-verbaux et ordres du jour apparaîtront ici dès leur dépôt par le bureau.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByRole('link', {name: 'Contact'})).toBeInTheDocument()
  })

  it('1c : chargement, trois lignes en attente sous le titre', () => {
    const {container} = render(<MySharedDocumentsCardLoading />)

    const card = screen.getByRole('region', {
      name: 'Documents de l’association',
    })
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })
})
