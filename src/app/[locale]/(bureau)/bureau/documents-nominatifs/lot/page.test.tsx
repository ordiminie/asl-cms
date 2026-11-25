import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-document-dal', () => ({
  canManageCurrentMemberDocumentsDal: vi.fn(),
  getMemberDocumentBatchReachDal: vi.fn(),
  getMemberDocumentCategoryChoicesDal: vi.fn(),
}))
vi.mock('../actions', () => ({depositMemberDocumentBatchLineAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentBatchReachDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import MemberDocumentBatchPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async () => {
  const element = (await MemberDocumentBatchPage({
    params: Promise.resolve({locale: 'fr'}),
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
    {id: '44444444-4444-4444-8444-444444444444', name: 'Facture'},
  ])
  vi.mocked(getMemberDocumentBatchReachDal).mockResolvedValue({
    profilesWithReference: 2,
    profilesWithoutReference: 1,
  })
})

describe('/bureau/documents-nominatifs/lot (s32, écran 5)', () => {
  it('propose le lot avec les catégories et la portée du tenant courant', async () => {
    await renderPage()

    expect(getMemberDocumentBatchReachDal).toHaveBeenCalledWith(TENANT_ID)
    expect(getMemberDocumentCategoryChoicesDal).toHaveBeenCalledWith(TENANT_ID)
    expect(
      screen.getByRole('heading', {level: 1, name: 'Déposer en lot'})
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Fichiers')).toBeInTheDocument()
  })

  it('un compte qui ne gère pas les documents : accès refusé, rien lu', async () => {
    vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberDocumentBatchReachDal).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Fichiers')).toBeNull()
  })
})
