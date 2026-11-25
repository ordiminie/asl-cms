import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()})}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-document-dal', () => ({
  canManageCurrentMemberDocumentsDal: vi.fn(),
  getMemberDocumentsForBureauDal: vi.fn(),
  getMemberDocumentCategoryChoicesDal: vi.fn(),
}))
vi.mock('./actions', () => ({removeMemberDocumentAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
  getMemberDocumentsForBureauDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauMemberDocumentsPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

const renderPage = async (
  searchParams: {
    q?: string
    categorie?: string
    page?: string
    statut?: string
  } = {}
) => {
  const element = (await BureauMemberDocumentsPage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(true)
  vi.mocked(getMemberDocumentCategoryChoicesDal).mockResolvedValue([
    {id: CATEGORY_ID, name: 'Facture'},
  ])
  vi.mocked(getMemberDocumentsForBureauDal).mockResolvedValue({
    documents: [],
    total: 0,
    page: 1,
    pageSize: 25,
    countsByCategory: {},
    parcelNumbersByProfile: {},
  })
})

describe('/bureau/documents-nominatifs (s32, écran 4, critère 6)', () => {
  it('lit la page du tenant courant avec les filtres de l’URL', async () => {
    await renderPage({q: 'Lef', categorie: CATEGORY_ID, page: '2'})

    expect(getMemberDocumentsForBureauDal).toHaveBeenCalledWith(TENANT_ID, {
      search: 'Lef',
      categoryId: CATEGORY_ID,
      page: 2,
    })
    expect(
      screen.getByRole('heading', {level: 1, name: 'Documents nominatifs'})
    ).toBeInTheDocument()
  })

  it('une page illisible revient à la première', async () => {
    await renderPage({page: '-3'})

    expect(getMemberDocumentsForBureauDal).toHaveBeenCalledWith(TENANT_ID, {
      search: undefined,
      categoryId: undefined,
      page: 1,
    })
  })

  it('un compte qui ne gère pas les documents : accès refusé, rien lu', async () => {
    vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberDocumentsForBureauDal).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', {name: 'Documents nominatifs'})
    ).toBeNull()
  })

  it('?statut=retire dit le retrait', async () => {
    await renderPage({statut: 'retire'})

    expect(screen.getByRole('status')).toHaveTextContent('Document retiré.')
  })
})
