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
vi.mock('../../../../documents-nominatifs/actions', () => ({
  depositMemberDocumentAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'

import NewMemberDocumentPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async () => {
  const element = (await NewMemberDocumentPage({
    params: Promise.resolve({locale: 'fr', id: PROFILE_ID}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(true)
  vi.mocked(getMemberProfileForBureauDal).mockResolvedValue({
    id: PROFILE_ID,
    name: 'Bernard Lefèvre',
  } as MemberProfileDTO)
  vi.mocked(getMemberParcelsForBureauDal).mockResolvedValue({
    current: [{parcelId: 'p', number: '61', startsOn: '2020-01-01'}],
    former: [],
  })
  vi.mocked(getMemberDocumentCategoryChoicesDal).mockResolvedValue([
    {id: '44444444-4444-4444-8444-444444444444', name: 'Facture'},
  ])
})

describe('/bureau/proprietaires/[id]/documents/nouveau (s32, écran 3)', () => {
  it('propose le dépôt pour la fiche du tenant courant, avec ses parcelles actuelles', async () => {
    await renderPage()

    expect(getMemberProfileForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
    expect(getMemberDocumentCategoryChoicesDal).toHaveBeenCalledWith(TENANT_ID)
    expect(
      screen.getByRole('heading', {level: 1, name: 'Déposer un document'})
    ).toBeInTheDocument()
    expect(screen.getByText(/Parcelle/)).toHaveTextContent('Parcelle 61')
  })

  it('un compte qui ne gère pas les documents : accès refusé, rien lu', async () => {
    vi.mocked(canManageCurrentMemberDocumentsDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberProfileForBureauDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', {name: 'Titre'})).toBeNull()
  })

  it("fiche d'une autre association : introuvable", async () => {
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
