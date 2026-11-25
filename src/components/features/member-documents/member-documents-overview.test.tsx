import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {
  BureauMemberDocumentDTO,
  BureauMemberDocumentPageDTO,
} from '@/services/types/domain/member-document-types'

import {MemberDocumentsOverview} from './member-documents-overview'

const PROFILE_ID = 'a1200000-0000-4000-8000-000000000008'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const INVOICE = '44444444-4444-4444-8444-444444444444'
const NOTICE = '55555555-5555-4555-8555-555555555555'

const documentOf = (
  overrides: Partial<BureauMemberDocumentDTO> = {}
): BureauMemberDocumentDTO => ({
  id: DOCUMENT_ID,
  title: 'Facture 2026',
  categoryId: INVOICE,
  categoryName: 'Facture',
  documentDate: '2026-03-15',
  fileBytes: 310 * 1024,
  createdAt: new Date('2026-03-16T10:00:00Z'),
  memberProfileId: PROFILE_ID,
  memberProfileName: 'Bernard Lefèvre',
  ...overrides,
})

const pageOf = (
  overrides: Partial<BureauMemberDocumentPageDTO> = {}
): BureauMemberDocumentPageDTO => ({
  documents: [documentOf()],
  total: 1,
  page: 1,
  pageSize: 25,
  countsByCategory: {[INVOICE]: 406, [NOTICE]: 406},
  parcelNumbersByProfile: {[PROFILE_ID]: ['61', '62']},
  ...overrides,
})

const CATEGORIES = [
  {id: INVOICE, name: 'Facture'},
  {id: NOTICE, name: 'Convocation'},
]

const removeAction = vi.fn()

const renderOverview = (
  props: Partial<Parameters<typeof MemberDocumentsOverview>[0]> = {}
) =>
  render(
    <MemberDocumentsOverview
      list={pageOf()}
      categories={CATEGORIES}
      removeAction={removeAction}
      {...props}
    />
  )

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  removeAction.mockResolvedValue({status: 'idle'})
})

describe('MemberDocumentsOverview — écran 4 du design s32 (critère 6)', () => {
  it('4a : titre, barre (catégories + lot), tableau avec fiche et parcelles', () => {
    renderOverview()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Documents nominatifs'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer les catégories'})
    ).toHaveAttribute('href', '/bureau/documents-nominatifs/categories')
    expect(screen.getByRole('link', {name: 'Déposer en lot'})).toHaveAttribute(
      'href',
      '/bureau/documents-nominatifs/lot'
    )

    const table = screen.getByRole('table')
    const [row] = within(table).getAllByRole('row').slice(1)
    expect(
      within(row).getByRole('link', {name: 'Bernard Lefèvre'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_ID}`)
    expect(row).toHaveTextContent('Parcelles 61 et 62')
    expect(row).toHaveTextContent('Facture 2026')
    expect(row).toHaveTextContent('15/03/2026')
    expect(row).toHaveTextContent('310 Ko')
    expect(
      within(row).getByRole('link', {
        name: 'Télécharger « Facture 2026 » (PDF, 310 Ko)',
      })
    ).toHaveAttribute('href', `/api/member-documents/${DOCUMENT_ID}`)
  })

  it('4a : la recherche est un formulaire GET qui pose q, et garde la catégorie', () => {
    renderOverview({search: 'Lef', categoryId: INVOICE})

    const search = screen.getByRole('search')
    expect(search).toHaveAttribute('action', '/bureau/documents-nominatifs')
    expect(
      within(search).getByRole('searchbox', {name: 'Rechercher une fiche'})
    ).toHaveValue('Lef')
    expect(
      search.querySelector('input[type="hidden"][name="categorie"]')
    ).toHaveValue(INVOICE)
  })

  it('4a : le filtre de catégorie porte le décompte et revient à la page 1', async () => {
    const user = userEvent.setup()
    renderOverview({search: 'Lef', list: pageOf({page: 3, total: 80})})

    await user.click(screen.getByRole('combobox', {name: 'Catégorie'}))
    expect(
      screen.getByRole('option', {name: 'Toutes (812)'})
    ).toBeInTheDocument()
    await user.click(screen.getByRole('option', {name: 'Convocation (406)'}))

    expect(router.push).toHaveBeenCalledWith(
      `/bureau/documents-nominatifs?q=Lef&categorie=${NOTICE}`
    )
  })

  it('4a : résumé annoncé sous les filtres', () => {
    renderOverview({search: 'Lef'})

    expect(screen.getByText(/1 document — « Lef »/)).toHaveAttribute(
      'aria-live',
      'polite'
    )
  })

  it('pagination serveur écrite, inactive annoncée', () => {
    renderOverview({list: pageOf({page: 2, total: 60}), search: 'Lef'})

    expect(screen.getByRole('link', {name: 'Précédent'})).toHaveAttribute(
      'href',
      '/bureau/documents-nominatifs?q=Lef'
    )
    expect(screen.getByRole('link', {name: 'Suivant'})).toHaveAttribute(
      'href',
      '/bureau/documents-nominatifs?q=Lef&page=3'
    )
    expect(screen.getByText('Page 2 sur 3')).toBeInTheDocument()
  })

  it('4b : vide', () => {
    renderOverview({
      list: pageOf({documents: [], total: 0, countsByCategory: {}}),
    })

    expect(screen.getByText(/Aucun document nominatif\./)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('4b′ : filtre sans résultat, avec de quoi effacer les filtres', () => {
    renderOverview({
      list: pageOf({documents: [], total: 0}),
      search: 'Duval',
    })

    expect(
      screen.getByText('Aucun document ne correspond à ces filtres.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Effacer les filtres'})
    ).toHaveAttribute('href', '/bureau/documents-nominatifs')
  })

  it('retrait : alert-dialog puis retour à la vue d’ensemble', async () => {
    const user = userEvent.setup()
    renderOverview()

    await user.click(
      within(screen.getByRole('table')).getByRole('button', {name: /Retirer/})
    )
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Retirer le document',
      })
    )

    expect(removeAction).toHaveBeenCalledWith(DOCUMENT_ID, 'overview')
  })

  it('succès du retrait ancré en tête de page', () => {
    renderOverview({notice: {kind: 'removed'}})

    expect(screen.getByRole('status')).toHaveTextContent('Document retiré.')
  })
})
