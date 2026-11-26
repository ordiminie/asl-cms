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
vi.mock('@/app/dal/document-template-dal', () => ({
  canManageCurrentDocumentTemplatesDal: vi.fn(),
  getDocumentTemplatesForBureauDal: vi.fn(),
  getDocumentLotGroupsForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/member-document-dal', () => ({
  canManageCurrentMemberDocumentsDal: vi.fn(),
  getMemberDocumentCategoryChoicesDal: vi.fn(),
}))
vi.mock('../actions', () => ({
  depositTemplateDocumentAction: vi.fn(),
  getDocumentLotReachAction: vi.fn(),
}))

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentLotGroupsForBureauDal,
  getDocumentTemplatesForBureauDal,
} from '@/app/dal/document-template-dal'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import DocumentLotPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async (searchParams: {modele?: string} = {}) => {
  const element = (await DocumentLotPage({
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
  vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(true)
  vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(true)
  vi.mocked(getDocumentTemplatesForBureauDal).mockResolvedValue([
    {
      id: TEMPLATE_ID,
      name: 'Convocation AG',
      variables: [],
      updatedAt: new Date(),
    },
  ])
  vi.mocked(getDocumentLotGroupsForBureauDal).mockResolvedValue([])
  vi.mocked(getMemberDocumentCategoryChoicesDal).mockResolvedValue([
    {id: 'c1', name: 'Convocation'},
  ])
})

describe('/bureau/modeles-documents/lot (s36, écran 4)', () => {
  it('ouvre le formulaire, modèle présélectionné par ?modele=', async () => {
    await renderPage({modele: TEMPLATE_ID})

    expect(
      screen.getByRole('heading', {level: 1, name: 'Générer en lot'})
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', {name: 'Modèle'})).toHaveTextContent(
      'Convocation AG'
    )
  })

  it('un ?modele= qui n’est pas un modèle du tenant ne présélectionne rien', async () => {
    await renderPage({modele: 'autre'})

    expect(screen.getByRole('combobox', {name: 'Modèle'})).toHaveTextContent(
      'Choisissez un modèle'
    )
  })

  it.each([
    ['l’action des modèles', canManageCurrentDocumentTemplatesDal],
    ['member.document.manage', canManageCurrentMemberDocumentsDal],
  ])('refusé sans %s, rien n’est lu', async (_label, dal) => {
    vi.mocked(dal).mockResolvedValue(false)

    await renderPage()

    expect(getDocumentTemplatesForBureauDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', {name: 'Générer en lot'})).toBeNull()
  })

  it('aucun modèle : 3f, formulaire non proposé', async () => {
    vi.mocked(getDocumentTemplatesForBureauDal).mockResolvedValue([])

    await renderPage()

    expect(screen.getByText('Aucun modèle de document.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('aucune catégorie active : formulaire non proposé', async () => {
    vi.mocked(getMemberDocumentCategoryChoicesDal).mockResolvedValue([])

    await renderPage()

    expect(
      screen.getByText('Aucune catégorie de document nominatif.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
