import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: navigation.notFound,
  useRouter: () => ({push: vi.fn()}),
}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-profile-dal', () => ({
  getMemberParcelsForBureauDal: vi.fn(),
  getMemberProfileForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/member-document-dal', () => ({
  canManageCurrentMemberDocumentsDal: vi.fn(),
  getMemberDocumentCategoryChoicesDal: vi.fn(),
}))
vi.mock('@/app/dal/document-template-dal', () => ({
  canManageCurrentDocumentTemplatesDal: vi.fn(),
  getDocumentTemplatesForBureauDal: vi.fn(),
  getTemplateDocumentRecipientForBureauDal: vi.fn(),
}))
vi.mock('../../../../modeles-documents/actions', () => ({
  depositTemplateDocumentAction: vi.fn(),
}))

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentTemplatesForBureauDal,
  getTemplateDocumentRecipientForBureauDal,
} from '@/app/dal/document-template-dal'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import GenerateMemberDocumentPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async () => {
  const element = (await GenerateMemberDocumentPage({
    params: Promise.resolve({locale: 'fr', id: PROFILE_ID}),
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
  vi.mocked(getMemberProfileForBureauDal).mockResolvedValue({
    id: PROFILE_ID,
    name: 'Bernard Lefèvre',
  } as never)
  vi.mocked(getMemberParcelsForBureauDal).mockResolvedValue({
    current: [{number: '12'}],
    former: [],
  } as never)
  vi.mocked(getDocumentTemplatesForBureauDal).mockResolvedValue([
    {
      id: 't1',
      name: 'Convocation AG',
      variables: [],
      updatedAt: new Date(),
    },
  ])
  vi.mocked(getTemplateDocumentRecipientForBureauDal).mockResolvedValue({
    addressLines: ['Bernard Lefèvre', '4 allée des Tilleuls'],
  })
  vi.mocked(getMemberDocumentCategoryChoicesDal).mockResolvedValue([
    {id: 'c1', name: 'Convocation'},
  ])
})

describe('/bureau/proprietaires/[id]/documents/generer (s36, écran 3)', () => {
  it('montre la fiche, l’adresse imprimée, les modèles et la case de dépôt', async () => {
    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Générer un document'})
    ).toBeInTheDocument()
    expect(screen.getByText('4 allée des Tilleuls')).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: 'Déposer aussi dans le dossier de la fiche',
      })
    ).toBeInTheDocument()
    expect(getDocumentTemplatesForBureauDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('sans member.document.manage : case non rendue, catégories non lues', async () => {
    vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(false)

    await renderPage()

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(getMemberDocumentCategoryChoicesDal).not.toHaveBeenCalled()
  })

  it('refuse un compte sans l’action des modèles, sans lire la fiche', async () => {
    vi.mocked(canManageCurrentDocumentTemplatesDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberProfileForBureauDal).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', {name: 'Générer un document'})
    ).toBeNull()
  })

  it('fiche d’une autre association : 404', async () => {
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
